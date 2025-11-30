var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var expressSession = require('express-session');
var passport = require('passport');
var localStrategy = require('passport-local').Strategy;
var nodemailer = require('nodemailer');
var flash = require('connect-flash');
var async = require('async');
var crypto = require('crypto');
var shortid = require('shortid');
var nodemailerSendgrid = require('nodemailer-sendgrid');
const { exec } = require('child_process');
const endpointSecret = 'whsec_MpnwtFm1rNBEvCPcV9STOnlGzVgGm6Cy';
const bodyParser = require('body-parser');
const flashMessageMiddleware = require('./middlewares/flashMessage');
//var refURL = 'default';
//var couponURL = 0;
var min = 10000;
var max = 99999;
var generator = require('generate-password');
require('./models');
var dotenv = require('dotenv');
//var createError = require('http-errors');
dotenv.config();

var User = mongoose.model('User');
var additionalServer = mongoose.model('additionalServer');

// Set your secret key. Remember to switch to your live secret key in production!
// See your keys here: https://dashboard.stripe.com/account/apikeys
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

var app = express();

// mongoose.set('bufferCommands', false);

const newConnection = async () => {
    try {
        await mongoose.connect("mongodb+srv://Terra:Starkhaven1%2E@cluster0.l6jwx.mongodb.net/rustdedicatedv2?authSource=admin&compressors=zlib&retryWrites=true&w=majority&ssl=true", { useNewUrlParser: true, useUnifiedTopology: true });
        // if (mongoose.connection.readyState !== 1) {
        //     app = null;
        // }
    } catch (error) {
        // if (mongoose.connection.readyState !== 1) {
        //     app = null;
        // }
        console.error("Error with mongoose connection");
    }
};

newConnection();


mongoose.connection.on('error', err => {
   console.log(err);
});

const connection = mongoose.connection;

connection.once("open", function() {
    console.log(mongoose.connection.readyState)
    console.log("MongoDB database connection established successfully");
});

global.mongoConnection = connection;

app.set('port', 3000);

var server = require('http').createServer(app);

server.listen(3000);

global.httpServer = server;

const io = require('socket.io')(server);



io.on('connection', (socket) => {
    console.log("socket is online");
    var serverStatusArray = [];

    //serverStatusArray.push(socket.req.user.serverOnline);

    //socket.emit('input', socket.req.user.serverOnline);

    socket.on("initPort", function(data) {
        console.log('receiving data from client');
        User.findOne({serverPort: parseInt(data), serverOnline: true}, function(err, user) {
            if (user) {
                socket.emit("serverUpdate", String(user.serverPort));
            } else {
                additionalServer.findOne({serverPort: parseInt(data), serverOnline: true}, function(err2, user2) {
                    if (user2) {
                        socket.emit("serverUpdate", String(user2.serverPort));
                    } else {
                        console.log(parseInt(data))
                        socket.emit("serverUpdate", "-1")
                    }
                })
            }
        })

    })

    socket.on("dateCheck", function(data) {
        var currentDate = new Date();
        console.log(data.email, data.oneMonth, data.time);
        if (currentDate.getTime() >= data.oneMonth) {
            User.findOne({email: data.email}, function(err, user) {
                if (user) {
                    user.oneMonth = Date.now() + 2678400000;
                    user.senderRef = "null2";
                    user.save()
                }
            })
            if (data.expired === 'true') {
                User.findOne({email: data.email}, function(err, user) {
                    if (user) {
                        user.refExpired = false;
                        user.refBackup = null;
                        user.save()
                    }
                })
            }
        }
        if (currentDate.getTime() >= data.time) {
            User.findOne({email: data.email}, function(err, user) {
                if (user) {
                    user.timePassed = Date.now() + 2764800000;
                    user.save();
                    if (user.refExpired) {
                        //do nothing

                    } else {

                    }

                }
            })
        }
    })

});

io.of('/my-servers');
//server.listen(app.get('port'));
io.on('connect_error', function(err) {
    console.log("client connect_error: ", err);
});

io.on('connect_timeout', function(err) {
    console.log("client connect_timeout: ", err);
});


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


// Match the raw body to content type application/json
app.post('/pay-success', bodyParser.raw({type: 'application/json'}), (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    }
    catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            //let end = false;
            User.findOne({email: session.customer_email, createExtraServer: true}, function(err, user) {
                if (user) {
                    let newServer = new additionalServer ({
                        email: session.customer_email,
                        customerId: session.customer,
                        serverCreate: true,
                        refLink: user.refLink,
                        subscriptionId: session.subscription,
                        subscriptionActive: true
                    })
                    newServer.save();

                    user.createExtraServer = false;
                    user.serverCount += 1;


                    // additionalServer.findOne({email: session.customer_email, acceptPayment: true}, function (err, found) {
                    //     if (found) {
                    //         found.subscriptionId = session.subscription;
                    //         found.acceptPayment = false;
                    //         found.save();
                    //         //end = true;
                    //     }
                    // })

                    user.save();
                }

            })

            // if (end) {
            //     break;
            // }
            console.log(session);
            User.findOne({
                email: session.customer_email, serverCount: 0
            }, function (err, user) {
                if (user) {
                    user.subscriptionActive = true;
                    user.subscriptionId = session.subscription;
                    user.customerId = session.customer;
                    user.timeOfSub = Date.now();
                    user.trialEnds = Date.now() + 259200000;
                    user.oneMonth = Date.now() + 2678400000;
                    user.refRefreshDate = Date.now() + 2678400000;
                    user.serverCreate = true;
                    user.timePassed = Date.now() + 3024000000;
                    user.serverCount += 1;
                    user.coupon = 0;
   
                    user.save(); // Don't use too many database operations here, it seems like the Stripe servers provide a limited time window
                                 // for their webhook.
                    
                   
                    // let ftpUser = Math.floor(Math.random() * (max - min + 1)) + min;

                    // let flag = true;
                    // while (flag) {
                    //     User.findOne({ftpName: "u" + ftpUser}, function (err, user2) {
                    //         if (!user2) {
                    //             user.ftpName = "u" + ftpUser;
                    //             flag = false;
                    //         } else {
                    //             ftpUser++;
                    //         }
                    //     })
                    //     if (ftpUser === 100000) {
                    //         ftpUser = 10000;
                    //     }
                    // }
                    //
                    // var customPass = generator.generate({
                    //     length: 12,
                    //     numbers: true,
                    //     symbols: true
                    // });
                    //
                    // user.ftpPass = customPass;
                    //
                    // let shortId = shortid.generate();
                    //
                    // User.findOne({refLink: shortId}, function(err, match) {
                    //     if (match) {
                    //         while(shortId.indexOf('-')>=0 || shortId === match.refLink) {
                    //             shortId = shortid.generate();
                    //         }
                    //     }
                    // })
                    //
                    // user.refLink = shortId;
                    // user.save();
                    //
                    // user.serverPort = 2457;
                    // var finished = false
                    //
                    // while(finished === false) {
                    //     User.findOne({serverPort: user.serverPort}, function(err, user2) {
                    //         if (user2) {
                    //             user2.serverPort +=1;
                    //         } else {
                    //             user.save();
                    //             finished = true;
                    //         }
                    //     })
                    //
                    // }
                    //
                    // User.findOne({refLink: user.senderRef}, function (err, user3) {
                    //     if (user3) {
                    //         user3.refLink = '(someone has signed up for a trial, awaiting invoice payment)'
                    //         user3.save();
                    //     }
                    // })
                }

            })
            break;
        case 'charge.succeeded':
            const invoiceSuccess = event.data.object;
            User.findOne({customerId: invoiceSuccess.customer}, function(err, user) {
                if (user) {
                    User.findOne({refLink: user.senderRef}, function (err2, user2) {
                        if (user2) {
                            User.findOne({senderRef: user2.refLink}, function(err3, user3) {
                                user3.refPaymentSucceeded = true;
                                //user3.senderRef = "null2";
                                user3.save();
                            })

                            user2.refBackup = user2.refLink;
                            user2.refLink = '(link is expired for this month because someone succeeded in subscribing from this link)'
                            user2.refExpired = true;
                            user2.successRefs += 1;
                            user2.save();


                            const coupon = stripe.coupons.create({
                                duration: 'once',
                                id: 'refSuccess',
                                percent_off: 50,
                            });

                            stripe.subscriptions.update(
                                user2.subscriptionId,
                                {
                                    proration_behavior: 'none',
                                    coupon: 'refSuccess',
                                }
                            );

                        }
                    })
                }

            })
            break;
        case 'customer.subscription.deleted':
            const sessionSub = event.data.object;

            User.findOne({subscriptionId: sessionSub.id}, function(err, user) {
                if (user) {

                    exec('/userDelete.sh ' + user.ftpName, function (err, stdout, stderr) {
                        if (stdout) {
                            user.subscriptionActive = false;
                            user.serverCount -= 1;
                            user.serverPort = 0;
                            user.subscriptionId = null;
                            user.ftpName = null;
                            user.ftpPass = null;
                            user.refLink = null;
                            // user.newUser = true;
                            user.timeOfSub = null;
                            user.trialEnds = null;
                            user.serverName = "Valheim Server";
                            user.serverOnline = false;
                            user.serverPassword = "53241";
                            user.serverVisibility = "1";
                            user.worldName = "vhserver";
                            user.save();


                            if (user.serverCount === 0) {

                                user.newUser = true;
                                user.save();

                            }
                            
                        }
                    });

                    
                }
            })

            additionalServer.findOne({subscriptionId: sessionSub.id}, function(err, user) {
                if (user) {
                    exec('/userDelete.sh ' + user.ftpName, function (err, stdout, stderr) {
                        if (stdout) {
                            user.subscriptionActive = false;
                            user.serverPort = 0;
                            user.subscriptionId = null;
                            user.ftpName = null;
                            user.ftpPass = null;
                            user.refLink = "defaultRef";
                            user.serverName = "Valheim Server";
                            user.serverOnline = false;
                            user.email = null;
                            user.customerId = null;
                            user.serverPassword = "53241";
                            user.serverVisibility = "1";
                            user.worldName = "vhserver";
                            user.save();
                        }
                    });
                    User.findOne({email: user.email}, function(err2, user2) {
                        if (user2) {
                            user2.serverCount -= 1;
                            user2.save();
                            if (user2.serverCount === 0) {
                                user2.newUser = true;
                                user2.save();
                            }
                        }
                      
                    })
                }
            })
            break;
        case 'payment_method.attached':
            const paymentMethod = event.data.object;
            console.log('PaymentMethod was attached to a Customer!');
            break;
        // ... handle other event types
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    response.json({received: true});
});



app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressSession({
    //key: "connect.sid",
    secret: "wedjwedj2230e2389e2djwd8wed231rjf3483893fpifeki3diedwuiedui232e2d"
    //store: store1 //MongoStore.create({ mongoUrl: "mongodb+srv://Terra:Starkhaven1%2E@cluster0.l6jwx.mongodb.net/rustdedicatedv2?authSource=admin&compressors=zlib&retryWrites=true&w=majority&ssl=true"})
}));
app.use(flash());
app.use(flashMessageMiddleware.flashMessage);
app.use(passport.initialize());
app.use(passport.session());


passport.use(new localStrategy({
    usernameField: "email",
    passwordField: "password"
}, function(email, password, next) {
    User.findOne({
        email: email
    }, function(err, user) {
        if (err) return next(err);
        if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
            return next({message: "Email or password incorrect"});
        }
        next(null, user);
    })
}));

passport.use('signup-local', new localStrategy({
    usernameField: "email",
    passwordField: "password"
}, function(email, password, next) {
    User.findOne({
        email: email
    }, function(err, user) {
        if (err) return next(err);
        if (user) return next({message: "User already exists"});
        let newUser = new User ({
            email: email,
            passwordHash: bcrypt.hashSync(password, 10)
        })
        newUser.save(function(err) {
            next(err, newUser)
        });
    })

}));

passport.serializeUser(function(user, next) {
    next(null, user._id)
});

passport.deserializeUser(function(id, next) {
    User.findById(id, function(err, user) {
        next(err, user)
    })
});


app.get('/', function (req, res, next) {


    // stripe.checkout.sessions.create({
    //     //customer_email: ,
    //     payment_method_types: ['card'],
    //     subscription_data: {
    //         trial_period_days: 30,
    //     },
    //     line_items: [{
    //         price: 'price_1I9xm0Apb214pLqIdccmrgsi',
    //         quantity: 1,
    //     }],
    //     mode: 'subscription',
    //     success_url: 'http://localhost:3000/billing?session_id={CHECKOUT_SESSION_ID}',
    //     cancel_url: 'http://localhost:3000/',
    // }, function (err, session) {
    //     if (err) return next(err)
    //     res.render('index', {sessionId: session.id, subscriptionActive: false})
    // });

    var referred = false;
    var ref = "noRef";

  res.render('index', {title: "rustdedicated", cameFromRef: referred, refCarrier: ref})
})






app.get('/main', function(req, res, next) {
    res.render('main')
})

app.get('/logout', function (req, res, next) {
    req.logout();
    res.redirect('/');
})

app.get('/forgot', function(req, res) {
    res.render('forgot', {
        user: req.user
    });
});

app.get('/create-server', function(req, res, next) {


    additionalServer.findOne({email: req.user.email, serverCreate: true, refLink: req.user.refLink}, function(err, user) {
        if (user) {
            user.serverCreate = false;
            user.save();

            let ftpUser = Math.floor(Math.random() * (max - min + 1)) + min;
            let ftpArray = [];
            let portArray = [];

            User.find({ftpName: {$ne: null}, serverPort: {$gt: 0}}, function(err2, docs) {
                if (docs) {
                    for (var i=0; i<docs.length; i++) {
                        var ftpValue = docs[i].toObject().ftpName;
                        ftpArray.push(ftpValue);
                        var portValue = docs[i].toObject().serverPort;
                        portArray.push(portValue);
                    }
                    console.log(ftpArray.length);
                    console.log(portArray.length);
                }
                additionalServer.find({ftpName: {$ne: null}, serverPort: {$gt: 0}}, function(err2, docs) {
                    if (docs) {
                        for (var i=0; i<docs.length; i++) {
                            var ftpValue = docs[i].toObject().ftpName;
                            ftpArray.push(ftpValue);
                            var portValue2 = docs[i].toObject().serverPort;
                            portArray.push(portValue2);
                        }
                        console.log(ftpArray.length);
                    }
                    for (var i=0; i<ftpArray.length; i++) {
                        //console.log(ftpArray[i]);
                        if ("u" + ftpUser === ftpArray[i]) {
                            ftpUser = Math.floor(Math.random() * (max - min + 1)) + min;
                            i = 0;
                            continue;
                        }
                    }
                    user.ftpName = "u" + ftpUser;
                    console.log("above password gen");
                    var customPass = generator.generate({
                        length: 12,
                        numbers: true
                        //symbols: true
                    });

                    user.ftpPass = customPass;
                    user.serverPort = Math.floor(Math.random() * (9990 - 2457 + 1)) + 2457;
                    for (var i=0; i<portArray.length; i++) {
                        if (JSON.stringify(user.serverPort) === JSON.stringify(portArray[i])) {
                            console.log('inside again');
                            //console.log(portArray[i]);
                            user.serverPort++;
                            console.log(req.user.serverPort);
                            i = 0;
                            continue;
                        }
                    }
                    console.log(user.ftpName);
                    console.log(user.serverPort);
                    console.log(JSON.stringify(portArray));
                    user.refLink = "defaultRef";
                    user.save();

                    console.log('inside');

                    console.log(user.ftpName);

                    exec('/serverCreation.sh ' + user.ftpName + " " + user.ftpPass + " " + user.serverPort, function (err4, stdout, stderr) {
                        if (stdout) {
                            user.serverOnline = true;
                            user.save();
                            exec('/writePermission.sh ' + user.ftpName);
                        }
                    });
                    console.log('check ftp name');
                    // additionalServer.findOne({email: req.user.email, refLink: req.user.refLink}, function(err3, user2) {
                    //     if (user2) {
                    //
                    //     }
                    // })
                    console.log(JSON.stringify(ftpArray));

                    // additionalServer.findOne({email: req.user.email, refLink: req.user.refLink}, function(err3, user3) {
                    //
                    //     if (user3) {
                    //
                    //
                    //     }
                    //
                    //
                    // })
                })
            })

            // User.findOne({ftpName: "u" + ftpUser}, function (err, user2) {
            //     if (!user2) {
            //
            //         req.user.ftpName = "u" + ftpUser;
            //     } else {
            //         ftpUser++;
            //
            //     }
            // })
            // if (ftpUser === 100000) {
            //     ftpUser = 10000;
            // }

            // User.find({serverPort: {$gt: 0}}, function(err2, docs) {
            //     if (docs) {
            //         for (var i=0; i<docs.length; i++) {
            //             var portValue = docs[i].toObject().serverPort;
            //             portArray.push(portValue);
            //         }
            //         console.log(portArray.length);
            //     }
            //
            // })
            //
            //
            // additionalServer.find({serverPort: {$gt: 0}}, function(err2, docs) {
            //     if (docs) {
            //         for (var i=0; i<docs.length; i++) {
            //             var portValue2 = docs[i].toObject().serverPort;
            //             portArray.push(portValue2);
            //         }
            //     }
            //
            //
            //
            // })
        }



    })

    res.render('create-server', {subActive: req.user.subscriptionActive, serverCount: req.user.serverCount, time: req.user.timePassed.getTime()});

})

app.post('/signup',
    passport.authenticate('signup-local', { failureRedirect: '/' }),



    function(req, res) {
        res.redirect('/billing');
    });

app.post('/game-settings', function(req, res, next) {

    var port = req.body.portNumber;
    var serverName = req.body.serverName;
    var serverPassword = req.body.serverPassword;
    var visibility = req.body.visibility;
    var worldName = req.body.worldName;
    var ftpUser = req.body.ftp;

    console.log(worldName);
    console.log(visibility);
    console.log(serverName);
    console.log(serverPassword);
    console.log(ftpUser);

    User.findOne({email: req.user.email, serverPort: port}, function(err2, user2) {
        if (user2) {
            user2.serverName = serverName;
            user2.serverPassword = serverPassword;
            user2.serverVisibility = visibility;
            user2.worldName = worldName;
            user2.serverConfigSchema = 1;
            user2.save();
            if (worldName === "vhserver") {
                console.log("made it here");
                req.user.serverConfigScript = 2;
                req.user.save();

                res.redirect(303, '/my-servers');

            } else {
                req.user.serverConfigScript = 1;
                req.user.save();

                res.redirect(303, '/my-servers');

            }
        }

    })


    additionalServer.findOne({email: req.user.email, serverPort: port}, function(err, user) {
        if (user) {
            user.serverName = serverName;
            user.serverPassword = serverPassword;
            user.serverVisibility = visibility;
            user.worldName = worldName;
            user.save();
            req.user.serverConfigSchema = 2;
            req.user.tempFTP = ftpUser;

            if (worldName === "vhserver") {
                console.log("made it here");
                req.user.serverConfigScript = 2;
                req.user.save();

                res.redirect(303, '/my-servers');

            } else {
               req.user.serverConfigScript = 1;
               req.user.save();

               res.redirect(303, '/my-servers');
            }
        }

    })



})

app.post('/server-tools', function (req, res, next) {

    var buttonClicked = req.body.buttonClick
    var ftpName = req.body.ftp2

    if (buttonClicked === "Restart Server") {
        req.user.serverTool = 1;
        req.user.tempFTP = ftpName;
        req.user.save();
        res.redirect(303, '/my-servers');
    } else if (buttonClicked === "Update Server") {
        req.user.serverTool = 2;
        req.user.tempFTP = ftpName;
        req.user.save();
        res.redirect(303, '/my-servers');
    } else if (buttonClicked === "Backup Server") {
        req.user.serverTool = 3;
        req.user.tempFTP = ftpName;
        req.user.save();
        res.redirect(303, '/my-servers');
    } else if (buttonClicked === "Stop Server") {
        req.user.serverTool = 4;
        req.user.tempFTP = ftpName;
        req.user.save();
        res.redirect(303, '/my-servers');
    }


})

app.get('/referral-check', function (req, res, next) {
    var message;
    if (req.user.serverCount === 0) {
        message = "You must subscribe before gaining access to referrals!"
        return res.render('referral-check', {refMessage: message, refCount: req.user.successRefs});
    }

    User.findOne({$or: [{senderRef: req.user.refLink}, {senderRef: req.user.refBackup}] }, function(err, user) {
        if (user) {
            if (user.serverCount > 0) {
                if (user.refPaymentSucceeded === true) {
                    message = "Success! Someone has kept their subscription after the trial period, your subscription fee for the following month will be reduced by 50%."
                    return res.render('referral-check', {refMessage: message, refCount: req.user.successRefs});
                }
                message = "Someone has subscribed with your referral link! You will get the discount if they don't back out of the 3 day trial."
                return res.render('referral-check', {refMessage: message, refCount: req.user.successRefs});
            }
            message = "Someone has signed up with your referral link! Awaiting payment."
        }
        if (!user) {
            message = "No one has signed up with your referral link this month."
        }
        res.render('referral-check', {refMessage: message, refCount: req.user.successRefs});
    })

})

app.post('/customer-portal', async function(req, res, next) {

    const returnUrl = 'https://valheimdedicatedhosting.com/manage-subs';
    const customerId = req.user.customerId;

    const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });

    res.redirect(303, portalSession.url);
})

app.get('/tos', function(req, res, next) {
    res.render('tos');
})

app.get('/faq', function(req, res, next) {
    res.render('FAQ');
})

app.post('/create-checkout-session', async function(req, res, next) {

    try {

        req.user.createExtraServer = true;
        req.user.save();

        const session = await stripe.checkout.sessions.create({
            customer_email: req.user.email,
            mode: 'subscription',
            payment_method_types: ['card'],
            subscription_data: {
                trial_period_days: 3,
            },
            line_items: [
                {
                    price: 'price_1Kt8fWApb214pLqI0HbfOcq4',
                    // For metered billing, do not pass quantity
                    quantity: 1,
                },
            ],
            // {CHECKOUT_SESSION_ID} is a string literal; do not change it!
            // the actual Session ID is returned in the query parameter when your customer
            // is redirected to the success page.

            success_url: 'https://valheimdedicatedhosting.com/create-server',
            cancel_url: 'https://valheimdedicatedhosting.com/create-server',

            // success_url: 'http://valheimdedicatedhosting.com:3000/create-server?session_id={CHECKOUT_SESSION_ID}',
            // cancel_url: 'http://valheimdedicatedhosting.com:3000/create-server',
        });
        console.log(session);
        return res.redirect(303, session.url);
    } catch (err) {
        console.log(err);
    }

    //session();

    //res.redirect('/create-server');
})



app.get('/billing', function (req, res, next) {
    
    
    if (req.user.coupon !== 0) {


        stripe.checkout.sessions.create({
            customer_email: req.user.email,
            payment_method_types: ['card'],
            subscription_data: {
                trial_period_days: 3,
            },
            line_items: [{
                price: 'price_1Kt8fWApb214pLqI0HbfOcq4',
                quantity: 1,
            }],
            mode: 'subscription',
            discounts: [{
                coupon: 'discount',
            }],
            success_url: 'https://valheimdedicatedhosting.com/billing?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'https://valheimdedicatedhosting.com/billing',
        }, function (err, session) {
            if (err) return next(err);

            if (req.user.tempRef !== null) {
                req.user.senderRef = req.user.tempRef;
                req.user.tempRef = null;
                req.user.save();
            }

            var subPrice = "$11.20"
            
            if (req.user.newUser) {
                    req.user.newUser = false;
                    req.user.save();
                
                    let ftpUser = Math.floor(Math.random() * (max - min + 1)) + min;
                    let ftpArray = [];
                    let portArray = [];

                    User.find({ftpName: {$ne: null}, serverPort: {$gt: 0}}, function(err, docs) {
                        if (docs) {
                            for (var i=0; i<docs.length; i++) {
                                var ftpValue = docs[i].toObject().ftpName;
                                ftpArray.push(ftpValue);
                                var portValue = docs[i].toObject().serverPort;
                                portArray.push(portValue);
                            }
                            console.log(ftpArray.length);
                        }
                        additionalServer.find({ftpName: {$ne: null}, serverPort: {$gt: 0}}, function(err2, docs2) {
                            if (docs2) {
                                for (var i=0; i<docs.length; i++) {
                                    var ftpValue2 = docs[i].toObject().ftpName;
                                    ftpArray.push(ftpValue2);
                                    var portValue2 = docs[i].toObject().serverPort;
                                    portArray.push(portValue2);
                                }
                                console.log(ftpArray.length);
                            }
                            for (var i=0; i<ftpArray.length; i++) {
                                //console.log(ftpArray[i]);
                                if ("u" + ftpUser === ftpArray[i]) {
                                    ftpUser = Math.floor(Math.random() * (max - min + 1)) + min;
                                    i = 0;
                                    continue;
                                }
                            }
                            console.log(JSON.stringify(ftpArray));
                            req.user.ftpName = "u" + ftpUser;

                            req.user.serverPort = Math.floor(Math.random() * (9990 - 2457 + 1)) + 2457;

                            for (var i=0; i<portArray.length; i++) {
                                if (JSON.stringify(req.user.serverPort) === JSON.stringify(portArray[i])) {
                                    console.log('inside');
                                    //console.log(portArray[i]);
                                    req.user.serverPort++;
                                    console.log(req.user.serverPort);
                                    i = 0;
                                    continue;
                                }
                            }
                            console.log(req.user.serverPort);
                            console.log(JSON.stringify(portArray));
                            console.log("above password gen");
                            var customPass = generator.generate({
                                length: 12,
                                numbers: true
                                //symbols: true
                            });

                            req.user.ftpPass = customPass;

                            let shortId2 = shortid.generate();

                            User.findOne({refLink: shortId2}, function(err3, match) {
                                if (match) {
                                    while(shortId2.indexOf('-')>=0 || shortId2 === match.refLink) {
                                        shortId2 = shortid.generate();
                                    }
                                }
                                req.user.refLink = shortId2;
                                req.user.save();
                                return res.render('billing', {sessionId: session.id, serverCount: req.user.serverCount, refLink: req.user.refLink, trialEnd: req.user.trialEnds, publicKey: process.env.STRIPE_PUBLIC_KEY, monthPassed: req.user.timePassed.getTime(), subActive: req.user.subscriptionActive, refExpired: req.user.refExpired, userEmail: req.user.email, day31: req.user.oneMonth.getTime(), priceOfSub: subPrice})
                            })
                        })

                    })
                
                
                
              
                
             

            } else {
                return res.render('billing', {sessionId: session.id, serverCount: req.user.serverCount, refLink: req.user.refLink, trialEnd: req.user.trialEnds, publicKey: process.env.STRIPE_PUBLIC_KEY, monthPassed: req.user.timePassed.getTime(), subActive: req.user.subscriptionActive, refExpired: req.user.refExpired, userEmail: req.user.email, day31: req.user.oneMonth.getTime(), priceOfSub: subPrice})
            }

            
        })
    } else {
         stripe.checkout.sessions.create({
            customer_email: req.user.email,
            payment_method_types: ['card'],
            subscription_data: {
                trial_period_days: 3,
            },
            line_items: [{
                price: 'price_1Kt8fWApb214pLqI0HbfOcq4',
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: 'https://valheimdedicatedhosting.com/billing?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'https://valheimdedicatedhosting.com/billing',
        }, function (err, session) {
            if (err) return next(err)
            
            if (Date.now() >= req.user.refRefreshDate && req.user.serverCount !== 0) {
                let shortId = shortid.generate();

                User.findOne({refLink: shortId}, function(err, match) {
                    if (match) {
                        while(shortId.indexOf('-')>=0 || shortId === match.refLink) {
                            shortId = shortid.generate();
                        }
                    }
                    req.user.refLink = shortId;
                    req.user.refRefreshDate = Date.now() + 2678400000;
                    req.user.save();
                })

            }



            if (req.user.serverCreate) {
                req.user.serverCreate = false;
                req.user.save();
                exec('/serverCreation.sh ' + req.user.ftpName + " " + req.user.ftpPass + " " + req.user.serverPort, function (err, stdout, stderr) {
                    if (stdout) {
                        req.user.serverOnline = true;
                        req.user.save();
                        exec('/writePermission.sh ' + req.user.ftpName, function (err2, stdout2, stderr2) {
                            if (stdout2) {

                            }
                        });
                    }
                });
            }
            // exec('/test');
            // if (req.user.serverCount === 0) {
            //     req.user.serverCount = 1
            //     req.user.ftpName = "u43543"
            //     req.user.ftpPass = "Starkhaven1."
            //     req.user.serverPort = 2476;
            //     req.user.save();
            //     exec('/serverCreation.sh ' + req.user.ftpName + " " + req.user.ftpPass + " " + req.user.serverPort, function (err, stdout, stderr) {
            //         if (stdout) {
            //             req.user.serverOnline = true;
            //             req.user.save();
            //         }
            //     });
            // }
            // if (req.user.serverCreate) {
            //     req.user.serverCreate = false;
            //     req.user.save()
            //
            //     exec('/test');
            // }
            var subPrice = "$14"

            if (req.user.newUser) {
                req.user.newUser = false;
                req.user.save();
    

                let ftpUser = Math.floor(Math.random() * (max - min + 1)) + min;
                let ftpArray = [];
                let portArray = [];

                User.find({ftpName: {$ne: null}, serverPort: {$gt: 0}}, function(err, docs) {
                    if (docs) {
                        for (var i=0; i<docs.length; i++) {
                            var ftpValue = docs[i].toObject().ftpName;
                            ftpArray.push(ftpValue);
                            var portValue = docs[i].toObject().serverPort;
                            portArray.push(portValue);
                        }
                        console.log(ftpArray.length);
                    }
                    additionalServer.find({ftpName: {$ne: null}, serverPort: {$gt: 0}}, function(err2, docs2) {
                        if (docs2) {
                            for (var i=0; i<docs.length; i++) {
                                var ftpValue2 = docs[i].toObject().ftpName;
                                ftpArray.push(ftpValue2);
                                var portValue2 = docs[i].toObject().serverPort;
                                portArray.push(portValue2);
                            }
                            console.log(ftpArray.length);
                        }
                        for (var i=0; i<ftpArray.length; i++) {
                            //console.log(ftpArray[i]);
                            if ("u" + ftpUser === ftpArray[i]) {
                                ftpUser = Math.floor(Math.random() * (max - min + 1)) + min;
                                i = 0;
                                continue;
                            }
                        }
                        console.log(JSON.stringify(ftpArray));
                        req.user.ftpName = "u" + ftpUser;

                        req.user.serverPort = Math.floor(Math.random() * (9990 - 2457 + 1)) + 2457;

                        for (var i=0; i<portArray.length; i++) {
                            if (JSON.stringify(req.user.serverPort) === JSON.stringify(portArray[i])) {
                                console.log('inside');
                                //console.log(portArray[i]);
                                req.user.serverPort++;
                                console.log(req.user.serverPort);
                                i = 0;
                                continue;
                            }
                        }
                        console.log(req.user.serverPort);
                        console.log(JSON.stringify(portArray));
                        console.log("above password gen");
                        var customPass = generator.generate({
                            length: 12,
                            numbers: true
                            //symbols: true
                        });

                        req.user.ftpPass = customPass;

                        let shortId2 = shortid.generate();

                        User.findOne({refLink: shortId2}, function(err, match) {
                            if (match) {
                                while(shortId2.indexOf('-')>=0 || shortId2 === match.refLink) {
                                    shortId2 = shortid.generate();
                                }
                            }
                            req.user.refLink = shortId2;
                            req.user.save();
                            return res.render('billing', {sessionId: session.id, serverCount: req.user.serverCount, refLink: req.user.refLink, trialEnd: req.user.trialEnds, publicKey: process.env.STRIPE_PUBLIC_KEY, monthPassed: req.user.timePassed.getTime(), subActive: req.user.subscriptionActive, refExpired: req.user.refExpired, userEmail: req.user.email, day31: req.user.oneMonth.getTime(), priceOfSub: subPrice})
                        })
                    })

                })

            } else {
                res.render('billing', {sessionId: session.id, serverCount: req.user.serverCount, refLink: req.user.refLink, trialEnd: req.user.trialEnds, publicKey: process.env.STRIPE_PUBLIC_KEY, monthPassed: req.user.timePassed.getTime(), subActive: req.user.subscriptionActive, refExpired: req.user.refExpired, userEmail: req.user.email, day31: req.user.oneMonth.getTime(), priceOfSub: subPrice})
            }


        });
        
        
    }

    

})

app.get('/my-servers', function(req, res, next) {
    var temp = "sed -i 's/# PLACE INSTANCE SETTINGS HERE/serverpassword='53241'/g'  ~/lgsm/config-lgsm/vhserver/vhserver.cfg"
    var temp2 = "sed -i 's/## These settings will apply to a specific instance./port='2457'/g'  ~/lgsm/config-lgsm/vhserver/vhserver.cfg"
    var temp3 = "sed -i 's/####### Instance Settings ########/servername='Valheim Server'/g'  ~/lgsm/config-lgsm/vhserver/vhserver.cfg"

    var portArray = [];
    var serverOnlineArray = [];
    var serverNameArray = [];

    if (req.user.serverTool === 1) {
        req.user.serverTool = 0;
        req.user.save();
        exec('/serverRestart.sh ' + req.user.tempFTP, function(err, stdout, stderr) {
            if (stdout) {
            }
        })
        req.user.tempFTP = null;
        req.user.save();
    } else if (req.user.serverTool === 2) {
        req.user.serverTool = 0;
        req.user.save();
        exec('/serverUpdate.sh ' + req.user.tempFTP, function(err, stdout, stderr) {
            if (stdout) {
            }
        })
        req.user.tempFTP = null;
        req.user.save();
    } else if (req.user.serverTool === 3) {
        req.user.serverTool = 0;
        req.user.save();
        var tempFTP2 = req.user.tempFTP;
        exec('/serverBackup.sh ' + req.user.tempFTP, function(err, stdout, stderr) {
            if (stdout) {

                function delBackup() {
                    exec('/setupRemoval.sh ' + tempFTP2, function(err2, stdout2, stderr2) {
                        if (stdout2) {

                        }
                    })
                }
            }
        })

        User.findOne({ftpName: tempFTP2}, function (err, user) {
            if (user) {
                user.backupRefresh = Date.now() + 86400000;
                user.save()
            }
            if (!user) {
                additionalServer.findOne({ftpName: tempFTP2}, function (err2, user2) {
                    if (user2) {
                        user2.backupRefresh = Date.now() + 86400000;
                        user2.save();
                    }
                })
            }
        })

        req.user.tempFTP = null;
        req.user.save();
    } else if (req.user.serverTool === 4) {
        req.user.serverTool = 0;
        req.user.save();
        exec('/serverStop.sh ' + req.user.tempFTP, function(err, stdout, stderr) {
            if (stdout) {

            }
        })
        req.user.tempFTP = null;
        req.user.save();
    }

    if (req.user.serverConfigSchema === 1) {
        User.findOne({email: req.user.email, serverConfigSchema: 1}, function (err, user) {
            if (user) {
                user.serverConfigSchema = 0;
                user.save();
                if (user.serverConfigScript === 2) {
                    console.log("made it here");
                    exec('/gameSettings2.sh ' + user.ftpName + " " + user.serverName + " " + user.serverPassword + " " + user.serverVisibility, function(err, stdout, stderr) {
                        if (stdout) {
                            console.log("made it inside");
                        }
                    })
                    user.serverConfigScript = 0;
                    user.save();
                } else if (user.serverConfigScript === 1) {
                    exec('/gameSettings.sh ' + user.ftpName + " " + user.serverName + " " + user.serverPassword + " " + user.serverVisibility + " " + user.worldName, function(err, stdout, stderr) {
                        if (stdout) {
                            console.log('made it in here #2');
                        }
                    })
                    user.serverConfigScript = 0;
                    user.save();
                }
            }
        })
    } else if (req.user.serverConfigSchema === 2) {
        additionalServer.findOne({email: req.user.email, ftpName: req.user.tempFTP}, function (err, user) {
            if (user) {
                req.user.serverConfigSchema = 0;
                req.user.tempFTP = null;
                req.user.save();
                if (req.user.serverConfigScript === 2) {
                    console.log("made it here");
                    exec('/gameSettings2.sh ' + user.ftpName + " " + user.serverName + " " + user.serverPassword + " " + user.serverVisibility, function(err, stdout, stderr) {
                        if (stdout) {
                            console.log("made it inside");
                        }
                    })
                    req.user.serverConfigScript = 0;
                    req.user.save();
                } else if (req.user.serverConfigScript === 1) {
                    exec('/gameSettings.sh ' + user.ftpName + " " + user.serverName + " " + user.serverPassword + " " + user.serverVisibility + " " + user.worldName, function(err, stdout, stderr) {
                        if (stdout) {
                            console.log('made it in here #2');
                        }
                    })
                    req.user.serverConfigScript = 0;
                    req.user.save();
                }
            }
        })
    }


    if (req.user.serverPort !== 0) {
        portArray.push(req.user.serverPort);
        serverNameArray.push(req.user.serverName);
        serverOnlineArray.push(req.user.serverOnline);
    }

    // additionalServer.find({email: req.user.email}, function(err, docs) {
    //     if (docs) {
    //         for (var i = 0; i<docs.length; i++) {
    //             var tempName = docs[i].toObject().serverName
    //             serverNameArray.push(tempName)
    //         }
    //     }
    // })

    additionalServer.find({email: req.user.email, serverPort: {$gte: 2457}}, function(err, docs) {
        if (docs) {
            for (var i = 0; i<docs.length; i++) {
                var tempPort = docs[i].toObject().serverPort;
                console.log(tempPort);
                portArray.push(tempPort);
                var tempName = docs[i].toObject().serverName;
                serverNameArray.push(tempName);
                var serverStatus = docs[i].toObject().serverOnline;
                serverOnlineArray.push(serverStatus);
            }

        }
        // for (var i = 0; i<portArray.length; i++) {
        //     additionalServer.findOne({serverPort: portArray[i]}, function(err, user) {
        //         if (user) {
        //             serverOnlineArray.push(additionalServer.serverOnline);
        //         }
        //     })
        // }
        console.log(portArray.toString());
        console.log(portArray[1]);
        res.render('my-servers', {serverCount: req.user.serverCount, serverOnline: serverOnlineArray, ports: portArray, names: serverNameArray, mongoURI: process.env.MONGO_URI, subActive: req.user.subscriptionActive})
    })

    // for (var i = 0; i<portArray.length; i++) {
    //     User.findOne({serverPort: portArray[i]}, function(err, user) {
    //         if (user) {
    //             serverOnlineArray.push(user.serverOnline);
    //         }
    //     })
    // }



})

app.get('/control-panel/:port', function(req, res, next) {

    var test1 = 0;
    var test2 = 0;
    var ftpName;
    var ftpPass;
    var serverPass;
    var serverName;
    var backupRefresh;
    var worldName;
    var currentTime = new Date;

    User.findOne({email: req.user.email, serverPort: req.params.port}, function(err, user) {
        if (!user) {
            console.log('reached 1st step');
            test1 = 1
        }
        if (user) {
            ftpName = user.ftpName;
            ftpPass = user.ftpPass;
            serverPass = user.serverPassword;
            serverName = user.serverName;
            backupRefresh = user.backupRefresh;
            worldName = user.worldName;

        }
        additionalServer.findOne({email: req.user.email, serverPort: req.params.port}, function(err2, user2) {
            if (!user2) {
                console.log('reached 2nd step')
                test2 = 1
                // next(createError(401));
                // res.render('error');
            }
            if (user2) {
                ftpName = user2.ftpName;
                ftpPass = user2.ftpPass;
                serverPass = user2.serverPassword;
                serverName = user2.serverName;
                backupRefresh = user2.backupRefresh;
                worldName = user2.worldName;

            }
            if (test1 === test2) {
                next(createError(401));
            } else {
                res.render('control-panel', {port: req.params.port, ftpUser: ftpName, ftpPassword: ftpPass, serverPassword: serverPass, sName: serverName, backupRenew: backupRefresh.getTime(), currentTime: currentTime.getTime(), world: worldName});
            }
        })
    })



    console.log(test1);
    console.log(test2);
})

app.get('/manage-subs', function(req, res, next) {

    var portArray = [];
    var nameArray = [];
    var serverOnlineArray = [];
    var tempPort = 0;
    var tempName = "temp";
    var tempStatus = "temp2";

    // if (req.user.serverName !== "default") {
    //     nameArray.push(req.user.serverName);
    // }
    //
    // if (req.user.serverPort !== 0) {
    //     portArray.push(req.user.serverPort);
    // }

    User.findOne({email: req.user.email, serverPort: {$gte: 2457}}, function(err, user) {
        if (user) {
            console.log('inside');
            nameArray.push(user.serverName);
            portArray.push(user.serverPort);
            serverOnlineArray.push(user.serverOnline);
            console.log(portArray.length);
        }
        additionalServer.find({email: req.user.email, serverPort: {$gte: 2457}}, function (err, docs) {
            if (docs) {
                for (var i = 0; i<docs.length; i++) {
                    tempPort = docs[i].toObject().serverPort;
                    tempName = docs[i].toObject().serverName;
                    tempStatus = docs[i].toObject().serverOnline;
                    portArray.push(tempPort);
                    nameArray.push(tempName);
                    serverOnlineArray.push(tempStatus);
                }
                console.log(portArray.length);
            }
            res.render('manage-subscriptions', {ports: portArray, serverCount: req.user.serverCount, names: nameArray, serverOnline: serverOnlineArray});
        })
    })



})

app.post('/manage-subs',  function(req, res, next) {

    var newPort = req.body.port;
    //var finalPort = newPort.split("port").join("");
    console.log(newPort);

    User.findOne({serverPort: newPort}, function(err, user) {
        if (user) {
            console.log('check');
            stripe.subscriptions.del(
                user.subscriptionId
            );
            // user.subscriptionActive = false;
            // user.serverCount -= 1;
            // user.save();

        }

    })

    additionalServer.findOne({serverPort: newPort}, function(err, user) {
        if (user) {
            stripe.subscriptions.del(
                user.subscriptionId
            );
            // user.subscriptionActive = false;
            // user.save();
            // User.findOne({email: user.email}, function(err, user2) {
            //     user2.serverCount -= 1;
            //     user2.save();
            // })
        }

    })

    res.redirect(303, '/billing');

})

app.get('/invite/:ref', function(req, res, next) {

    User.findOne({refLink: req.params.ref}, function(err, user) {
        if (!user) {
            return next(err);
        }
        if (user.refLink === null) {
            return next(err);
        }
        //user.coupon = 20;
        var ref = req.params.ref;
        var referred = true;
        res.render('index', {title: "rustdedicated", cameFromRef: referred, refCarrier: ref});
    })
})


app.post('/invite/signup',
    passport.authenticate('signup-local', { failureRedirect: '/' }),

    function(req, res, next) {
        User.findOne({refLink: req.body.refTransport}, function (err, user) {
            if (!user) {
                return next(err)
            }
            req.user.coupon = 20;
            req.user.tempRef = req.body.refTransport;
            req.user.save();
            stripe.coupons.create({
                duration: 'once',
                id: 'discount',
                percent_off: 20,
            });
            //console.log(couponURL);
            res.redirect('/billing');
        })
    });

app.post('/login',
    passport.authenticate('local', { failureRedirect: '/login-page' }),
    function(req, res) {
        res.redirect('/billing');
    });

app.get('/login-page', function(req, res, next) {
    res.render('login-page')
})



app.post('/forgot', function(req, res, next) {
    async.waterfall([
        function(done) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString('hex');
                done(err, token);
            });
        },
        function(token, done) {
            User.findOne({ email: req.body.email }, function(err, user) {
                if (!user) {
                    req.flash('error', 'No account with that email address exists.');
                    return res.redirect('/forgot');
                }

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

                user.save(function(err) {
                    done(err, token, user);
                });
            });
        },
        function(token, user, done) {
            var smtpTransport = nodemailer.createTransport( nodemailerSendgrid({
                    apiKey: process.env.SENDGRID_API_KEY
                })

            );
            var mailOptions = {
                to: user.email,
                from: 'admin@valheimdedicatedhosting.com',
                subject: 'www.valheimdedicatedhosting.com Password Reset',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'https://valheimdedicatedhosting.com' + '/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            smtpTransport.sendMail(mailOptions, function(err) {
                req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
                done(err, 'done');
            });
        }
    ], function(err) {
        if (err) return next(err);
        res.redirect('/forgot');
    });
});

app.get('/reset/:token', function(req, res) {
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        console.log(user)
        if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('/forgot');
        }
        res.render('reset', {
            user: req.user,
            passwordToken: user.resetPasswordToken
        });
    });
});

app.post('/reset/:token', function(req, res) {
    console.log('test')
    async.waterfall([
        function(done) {
            User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
                if (!user) {
                    req.flash('error', 'Password reset token is invalid or has expired.');
                    return res.redirect('/login-page');
                }

                console.log('test2')

                user.passwordHash = bcrypt.hashSync(req.body.password, 10);
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;

                console.log('test3')

                user.save(function(err) {
                    if (err) {
                        return res.redirect('/reset')
                    }
                    req.logIn(user, function(err) {
                        console.log('test4')
                        done(err, user);
                    });
                });
            });
        },
        function(user, done) {
            var smtpTransport = nodemailer.createTransport(nodemailerSendgrid ({
                    apiKey: process.env.SENDGRID_API_KEY
                })

            );
            var mailOptions = {
                to: user.email,
                from: 'admin@valheimdedicatedhosting.com',
                subject: 'Your password has been changed',
                text: 'Hello,\n\n' +
                    'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
            };
            smtpTransport.sendMail(mailOptions, function(err) {
                req.flash('success', 'Success! Your password has been changed.');
                done(err);
            });
        }
    ], function(err) {
        res.redirect('/billing');
    });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
