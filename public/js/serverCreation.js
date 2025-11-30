//
//
// #!/bin/bash
//
// varName=$1
// varPass=$2
// varPort=$3
//
// cd / &&
// adduser $varName <<EOF
// $varPass
// $varPass
// s
// s
// s
// s
// s
// y
// EOF
// su - $varName <<EOF
// wget -O linuxgsm.sh https://linuxgsm.sh && chmod +x linuxgsm.sh && bash linuxgsm.sh vhserver &&
// ./vhserver auto-install &&
// sed -i "s/## These settings will apply to a specific instance./port=$varPort/g"  ~/lgsm/config-lgsm/vhserver/vhserver.cfg
// EOF
