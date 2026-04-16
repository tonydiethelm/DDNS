/*
The purpose of this is to update the Namesilo DNS records when my public facing IP address changes. 
It is intended to be ran by a cron job every few minutes or so via node.


I am on a dynamic IP address.
I need to update DNS records with Namesilo every time it changes. 
That's annoying. 

Supporting documentation:
https://www.namesilo.com/api-reference
https://www.namesilo.com/api/dnsListRecords?version=1&type=xml&key=12345&domain=namesilo.com
https://www.namesilo.com/api/dnsUpdateRecord?version=1&type=xml&key=12345&domain=namesilo.com&rrid=1a2b3&rrhost=test&rrvalue=55.55.55.55&rrttl=7207

My API key is: "8540ca74c05a70e960e29e"

response is OK if JSON response.reply.code = 300. Anything else and we have problems. 

*/

//import needed stuff
import { promises as dnsPromises } from 'node:dns';
import emailjs from '@emailjs/nodejs';


//set up needed variables, but up here for easy changes instead of down there next to the code. 
const domains = ["tonydiethelm.life", "secretuniontalk.org"];
const myAPIkey = "8540ca74c05a70e960e29e";
const domainToCheck = "tonydiethelm.life";
const emailjsPublicKey = "UUcL3TXyiPEd1WUwF";
const emailjsPrivateKey = "b72CoT9oihEMSbvZ5THct";

/*
Function to send the email.
inputs are title and message. 
This sends from tonydiethelm@gmail.com to tonydiethelm@gmail.com
This is totally a hack, but it works and no one's going to see this. 
Yes, I hard coded my keys. I'm a bad person. 
*/
async function sendAnEmail(title, message){
emailjs.send('service_85os8xe', 'template_rrfzqsm', {title: title, message: message}, {
    publicKey: emailjsPublicKey,
    privateKey: emailjsPrivateKey, // optional, highly recommended for security reasons
  })
  .then(
    (response) => {
      console.log('email sent!', response.status, response.text);
    },
    (err) => {
      console.log('email not sent...', err);
    },
  );




}




/*
Get the IP that namesilo thinks I have. 
*/
let response = await dnsPromises.lookup(domainToCheck);
const publicDNSIP = response.address
//console.log("Namesilo thinks I am", publicDNSIP);

/*
get current public facing IP address.
use https://www.ipify.org/
*/
response = await fetch('https://api.ipify.org?format=json')
let responseDeJSONed = await response.json()
const currentPublicIP = responseDeJSONed.ip
//console.log("My IP addy from my ISP is", currentPublicIP);


/*
If current IP does not match old IP
    update the namesilo records
    Need the record_id in order to use dnsUpdateRecord, so have to do dnsListRecords first. 
*/
async function updateNamesilo(domain){
    //we need to use dnsListRecords first to get the record_id for the dnsUpdateRecord.
    let response = await fetch(`https://www.namesilo.com/api/dnsListRecords?version=1&type=json&key=${myAPIkey}&domain=${domain}`);
    let responseDeJSONed = await response.json();
    const record_id = responseDeJSONed.reply.resource_record[0].record_id;
    
    //now do the dnsUpdateRecord with the IP from our ISP
    response = await fetch(`https://www.namesilo.com/api/dnsUpdateRecord?version=1&type=json&key=${myAPIkey}&&rrvalue=${currentPublicIP}&domain=${domain}&rrid=${record_id}`);
    responseDeJSONed = await response.json();
    //console.log(responseDeJSONed);
    const responseCode = responseDeJSONed.reply.code;
    //console.log(responseCode);
    if(responseCode != 300){
        let message=`Something went wrong updating ${domain}. ${responseDeJSONed}`
        sendAnEmail("A DNS update failed!", message)
        console.log("We tried to update Namesilo and it didn't work!");
        return {success: false, message: message}
    }
    console.log("success")
    //sendAnEmail("DNS updated!", "Nothing to worry about!")
    return {success: true, message: `updated Namesilo! ${responseDeJSONed}`}
};




if(currentPublicIP != publicDNSIP){
    //email that there's a problem.
    const title = `Your IP for ${domainToCheck} changed!`;
    const message = `Your IP from your ISP is ${currentPublicIP} but your Domain Registrar thinks your IP is ${publicDNSIP}. Attempting to fix it.`
    sendAnEmail(title, message);
    /*
    forEach doesn't play nicely with async/await. Using a standard for of loop instead.
    */
    for(let domain of domains){
        const didItWork = await updateNamesilo(domain);
    }
};