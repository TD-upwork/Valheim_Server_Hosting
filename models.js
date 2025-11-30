var mongoose = require('mongoose');
const bcrypt = require("bcrypt");

var UserSchema = mongoose.model( "User", new mongoose.Schema({
    email: {type: String},
    passwordHash: {type: String},
    subscriptionActive: {type: Boolean, default: false},
    customerId: {type: String},
    subscriptionId: {type: String},
    resetPasswordToken: {type: String},
    resetPasswordExpires: {type: Date},
    refLink: {type: String, default: null},
    senderRef: {type: String, default: 'default'},
    timeOfSub: {type: Date, default: null},
    trialEnds: {type: Date, default: null},
    refPaymentSucceeded: {type: Boolean, default: false},
    serverCreate: {type: Boolean, default: false},
    serverCount: {type: Number, default: 0},
    serverOnline: {type: Boolean, default: false},
    serverPort: {type: Number, default: 0},
    ftpName: {type: String, default: null},
    ftpPass: {type: String, default: null},
    serverName: {type: String, default: "Valheim Server"},
    timePassed: {type: Date, default: Date.now()},
    newUser: {type: Boolean, default: true},
    createExtraServer: {type: Boolean, default: false},
    serverPassword: {type: String, default: "53241"},
    serverVisibility: {type: String, default: "1"},
    worldName: {type: String, default: "vhserver"},
    serverConfigScript: {type: Number, default: 0},
    serverConfigSchema: {type: Number, default: 0},
    serverTool: {type: Number, default: 0},
    tempFTP: {type: String, default: null},
    successRefs: {type: Number, default: 0},
    refExpired: {type: Boolean, default: false},
    oneMonth: {type: Date, default: Date.now()},
    refRefreshDate: {type: Date, default: Date.now() - 100000000},
    refBackup: {type: String, default: "thisisbackup"},
    backupRefresh: {type: Date, default: Date.now()},
    coupon: {type: Number, default: 0},
    tempRef: {type: String, default: null}
}))

mongoose.model("additionalServer", new mongoose.Schema({
    email: {type: String},
    subscriptionActive: {type: Boolean, default: false},
    customerId: {type: String},
    subscriptionId: {type: String},
    serverCreate: {type: Boolean, default: false},
    serverOnline: {type: Boolean, default: false},
    serverPort: {type: Number, default: 0},
    serverName: {type: String, default: "Valheim Sever"},
    paymentProcessed: {type: Number, default: null},
    ftpName: {type: String, default: null},
    ftpPass: {type: String, default: null},
    refLink: {type: String, default: "defaultRef"},
    acceptPayment: {type: Boolean, default: false},
    serverPassword: {type: String, default: "53241"},
    serverVisibility: {type: String, default: "1"},
    worldName: {type: String, default: "vhserver"},
    backupRefresh: {type: Date, default: Date.now()}
}))

// UserSchema.schema.pre('save', function(next) {
//     var user = this;
//     var SALT_FACTOR = 5;
//
//     if (!user.isModified('password')) return next();
//
//     bcrypt.genSalt(SALT_FACTOR, function(err, salt) {
//         if (err) return next(err);
//
//         bcrypt.hash(user.password, salt, null, function(err, hash) {
//             if (err) return next(err);
//             user.password = hash;
//             next();
//         });
//     });
// });
