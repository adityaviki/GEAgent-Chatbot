'use strict';

const functions = require('firebase-functions');
const admin = require("firebase-admin");
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

admin.initializeApp(functions.config().firebase);

const db = admin.database();

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  function welcome(agent) {
    agent.add(`Hi there! I am a chatbot for GE Appliance and I can help you book service appointments, reschedule or cancel your appointment. You can also get the details of your last appointment`);
    agent.add(new Suggestion(`Book`));
    agent.add(new Suggestion(`Reschedule`));
    agent.add(new Suggestion(`Cancel`));
    agent.add(new Suggestion(`Get details`));
  }
 
  function fallback(agent) {
    agent.add(`Sorry! I didn't get that`);
    agent.add(new Suggestion(`Book Appointment`));
    agent.add(new Suggestion(`Reschedule Appointment`));
    agent.add(new Suggestion(`Cancel Appointment`));
    agent.add(new Suggestion(`My Appointment`));
  }
  
  function bookAppointment(agent) {
    agent.add(`To book a service appointment you need to have the model number and the serial number of the appliance with you`);
    agent.add(`Do you wish to proceed?`);
    agent.setContext({name: 'cancel_conversation', lifespan: 1, parameters:{type: 'booking'}});
  }
  
  function modelNumber(agent) {
    let modelNumber = agent.parameters.modelNumber;
    modelNumber = modelNumber.toUpperCase();
    return db.ref("boughtAppliances").orderByChild("Model Number").equalTo(modelNumber).once("value").then(snapshot => {
      if(snapshot.exists()){
        agent.add(`Enter the serial number of the appliance`);
        agent.setContext({name: 'awaiting_serial_number', lifespan: 1, parameters: {modelNumber: modelNumber}});
      }
      else{
        agent.add(`Invalid model number. Please enter a valid model number`);
        agent.add(new Suggestion(`Cancel`));
        agent.setContext({name: 'awaiting_model_number', lifespan: 1});
      }
    }).catch( err => {
        console.log('Error', err);
    });
  }

  function serialNumber(value) {
    let serialNumber = agent.parameters.serialNumber;
    let modelNumber = agent.getContext('awaiting_serial_number').parameters.modelNumber;
    serialNumber = serialNumber.toUpperCase();
    return db.ref("boughtAppliances").orderByChild("Serial Number").equalTo(serialNumber).once("value").then(snapshot => {
      if(snapshot.exists()){
          let data;
          snapshot.forEach(snap => {
            data = snap.val();  
          });
          if(data["Model Number"] != modelNumber) {
            agent.add(`Serial number does not correspond to the provided model number.Please enter a valid serial number`);
            agent.add(new Suggestion(`Cancel`));
            agent.setContext({name: 'awaiting_serial_number', lifespan: 1});
          }
          else {
            agent.add(`So you are booking the appointment for your ${data['Product Line']}. We can send a technician at your place to look into the issue.`);
            agent.add(`Enter ok to continue`);
            agent.setContext({name: 'confirm_appliance', lifespan: 1});
            agent.setContext({name: 'cancel_conversation', lifespan: 1, parameters: {appliance: data['Product Line']}});
          }
      }
      else{
        agent.add(`Invalid serial number. Please enter a valid serial number`);
        agent.add(new Suggestion(`Cancel`));
        agent.setContext({name: 'awaiting_serial_number', lifespan: 1});
      }
    }).catch( err => {
        console.log('Error', err);
    });
  }

  function userName(agent) {
    let regex = /^[a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/g;
    let userName = agent.parameters.userName;
    if(regex.test(userName)) {
      agent.add(`Enter your email address`);
      agent.setContext({ name: 'awaiting_email', lifespan: 1});
    } else {
      agent.add(`Name should only contain letters and spaces. Try again`);
      agent.add(new Suggestion(`cancel`));
      agent.setContext({name: 'awaiting_user_name', lifespan: 1});
    }
  }
  
  function email(agent) {
    let regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/igm;
    let email = agent.parameters.email;
    if(regex.test(String(email).toLowerCase())) {
      agent.add(`Enter you phone number`);
      agent.setContext({ name: 'awaiting_phone_number', lifespan: 1});
    } else {
      agent.add(`Email address is not valid. Try again`);
      agent.add(new Suggestion(`cancel`));
      agent.setContext({name: 'awaiting_email', lifespan: 1});
    }
  }
  
  function phoneNumber(agent) {
    let regex = /^[0-9]{10}$/;
    let phoneNumber = agent.parameters.phoneNumber;
    if(regex.test(phoneNumber)) {
      agent.add(`Enter the address`);
      agent.setContext({ name: 'awaiting_address', lifespan: 1});
    } else {
      agent.add(`Invalid phone number. Enter a 10 digit phone number with no special characters.`);
      agent.add(new Suggestion(`cancel`));
      agent.setContext({name: 'awaiting_phone_number', lifespan: 1});
    }
  }
  
  function pincode(agent) {
    let regex = /^[1-9][0-9]{5}$/;
    let pincode = agent.parameters.pincode;
    if(regex.test(pincode)) {
      let schedules = generateSchedules();
      agent.setContext({ name: 'awaiting_schedule_time', lifespan: 1, parameters: schedules});
    } else {
      agent.add(`Invalid Pin Code. It should only contain 6 digits. Try again`);
      agent.add(new Suggestion('cancel'));
      agent.setContext({name: 'awaiting_pincode', lifespan: 1});
    }
  }

  function scheduleTime(agent) {
    let scheduleTime = agent.parameters.scheduleTime;
    let schedules = agent.getContext('awaiting_schedule_time').parameters;
    if((schedules.schedule1 === scheduleTime || schedules.schedule2 === scheduleTime || schedules.schedule3 === scheduleTime)) {
      agent.add(`Write the description of the issue you are facing with the appliance`);
      agent.setContext({ name: 'awaiting_description', lifespan: 1});
    } else {
      agent.add(`You can only choose one of the provided schedule`);
      agent.add(new Suggestion(schedules.schedule1)); agent.add(new Suggestion(schedules.schedule2)); agent.add(new Suggestion(schedules.schedule3));
      agent.add(new Suggestion(`Cancel`));
      agent.setContext({name: 'awaiting_schedule_time', lifespan: 1});
    }
  }
  
  function rescheduleTime(agent) {
    let scheduleTime = agent.parameters.scheduleTime;
    let schedules = agent.getContext('awaiting_reschedule_time').parameters;
    if((schedules.schedule1 === scheduleTime || schedules.schedule2 === scheduleTime || schedules.schedule3 === scheduleTime)) {
      agent.add(`Your appointment will be changed to "${scheduleTime}". Do you confirm?`);
      agent.add(new Suggestion(`Confirm`));
      agent.add(new Suggestion(`Cancel`));
      agent.setContext({name: 'change_schedule', lifespan: 1});
    } else {
      agent.add(`You can only choose one of the provided schedule`);
      agent.add(new Suggestion(schedules.schedule1)); agent.add(new Suggestion(schedules.schedule2)); agent.add(new Suggestion(schedules.schedule3));
      agent.add(new Suggestion(`cancel`));
      agent.setContext({name: 'awaiting_reschedule_time', lifespan:1});
    }
  }
  
  function generateSchedules() {
    let schedules = {};
    let schedule1 = generateScheduleTime();
    let schedule2 = generateScheduleTime();
    let schedule3 = generateScheduleTime();
    agent.add(`Choose one of the time slots available for the service appointment`);
    agent.add(new Suggestion(schedule1)); agent.add(new Suggestion(schedule2)); agent.add(new Suggestion(schedule3));
    schedules.schedule1 = schedule1; schedules.schedule2 = schedule2; schedules.schedule3 = schedule3;      
    return schedules;
  }
  
  function generateScheduleTime() {
    let date = 1 + Math.floor(Math.random() * 30);
    let day = ['Monday', 'Tuesday', 'Wednesday', 'Thrusday', 'Friday', 'Saturday', 'Sunday'];
    let time = ['10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM'];
    let a = Math.floor(Math.random() * 7);
    let schedule = day[a] + " " + date + " " + time[a] + " - " + time[a+3];
    return schedule;
  }

  function provideDescription(agent) {
    agent.add(`Great! We have all the information that we need`);
    let parameters = agent.getContext('cancel_conversation').parameters;
    agent.add( `Name:    ${parameters.userName}\nEmail:    ${parameters.email}\nPhone Number:    ${parameters.phoneNumber}\nAddress:    ${parameters.address}\nPin Code:    ${parameters.pincode}\nAppliance:    ${parameters.appliance}\nModel Number:    ${parameters.modelNumber}\nSerial Number:    ${parameters.serialNumber}\nAppointment Schedule:    ${parameters.scheduleTime}\nIssue Description:    ${parameters.description}`);
    agent.add(new Suggestion(`Confirm Booking`));
    agent.add(new Suggestion(`Cancel Booking`));
    agent.setContext({name: 'awaiting_booking_confirmation', lifespan: 1});
  } 

  function provideBookingConfirmation(agent) {
    let parameters = agent.getContext('cancel_conversation').parameters;
    let trackingNumber = Math.random().toString(36).substr(2, 7);
    trackingNumber = trackingNumber.toUpperCase();
    parameters.trackingNumber = trackingNumber;
    let userInfo = {
      uniqueTrackingNumber: trackingNumber,
      userName: parameters.userName,
      email: parameters.email,
      phoneNumber: parameters.phoneNumber,
      address: parameters.address,
      pincode: parameters.pincode,
      appliance: parameters.appliance,
      modelNumber: parameters.modelNumber,
      serialNumber: parameters.serialNumber,
      appointmentSchedule: parameters.scheduleTime,
      issueDescription: parameters.description
    };
    return db.ref("Appointments").child(trackingNumber).set(userInfo)
    .then(() =>{
      agent.add(`Appointment successfully booked. We will get back to you soon`);
      agent.add(`${trackingNumber} is your unique tracking number`);
      agent.add(`You can use it to check the details of your appointment. It can also be used to reschedule or cancel your appointment`);
    })
    .catch(error =>{
      console.error("Error writing user details: ", error);
    });
  }
  
  function rescheduleAppointment(agent) {
    agent.add(`To reschedule your service appointment. You need to have the tracking number with you that was provided at the time of appointment booking`);
    agent.add(`Do you wish to proceed?`);
    agent.setContext({name: 'cancel_conversation', lifespan: 1, parameters: {type: 'reschedule'}});
  }
  
  function appointmentRescheduled(agent) {
    let params = agent.getContext('cancel_conversation').parameters;
    let trackingNumber = params.trackingNumber;
    let rescheduleTime = params.scheduleTime;
    trackingNumber = trackingNumber.toUpperCase();
    return db.ref("Appointments").orderByChild("uniqueTrackingNumber").equalTo(trackingNumber).once("value").then(snapshot => {
      let parameters;
      snapshot.forEach(snap =>{
        parameters = snap.val();
      });
      return db.ref("Appointments").child(trackingNumber).update({scheduleTime: rescheduleTime}).then(()=>{
        agent.add(`Your appointment has been rescheduled`);
        agent.add(`Here's the details of your appointment`);
        agent.add( `Name:    ${parameters.userName}\nEmail:    ${parameters.email}\nPhone Number:    ${parameters.phoneNumber}\nAddress:    ${parameters.address}\nPin Code:    ${parameters.pincode}\nAppliance:    ${parameters.appliance}\nModel Number:    ${parameters.modelNumber}\nSerial Number:    ${parameters.serialNumber}\nAppointment Schedule:    ${parameters.appointmentSchedule}\nIssue Description:    ${parameters.issueDescription}`);
      });
    }).catch( err => {
        console.log('Error', err);
    });
  }
  
  function validateTrackingNumber(agent) {
    let trackingNumber = agent.parameters.trackingNumber;
    let type = agent.getContext('cancel_conversation').parameters.type;
    trackingNumber = trackingNumber.toUpperCase();
    return db.ref("Appointments").orderByChild("uniqueTrackingNumber").equalTo(trackingNumber).once("value").then(snapshot => {
      if(snapshot.exists()){
        switch (type) {
          case 'reschedule': {
            let schedules = generateSchedules();
            agent.setContext({ name: 'awaiting_reschedule_time', lifespan: 1, parameters: schedules});
            break;
            }
          case 'cancel':
            agent.add(`Are you Sure you want to cancel your appointment?`);
            agent.add(new Suggestion(`Confirm`));
            agent.add(new Suggestion(`Cancel`));
            agent.setContext({name: 'confirm_cancelation', lifespan: 1});
            break;
          case 'details':
            agent.add(`Here is all the details of your appointment`);
            let parameters;
            snapshot.forEach(snap =>{
            parameters = snap.val();
            });
            agent.add( `Name:    ${parameters.userName}\nEmail:    ${parameters.email}\nPhone Number:    ${parameters.phoneNumber}\nAddress:    ${parameters.address}\nPin Code:    ${parameters.pincode}\nAppliance:    ${parameters.appliance}\nModel Number:    ${parameters.modelNumber}\nSerial Number:    ${parameters.serialNumber}\nAppointment Schedule:    ${parameters.appointmentSchedule}\nIssue Description:    ${parameters.issueDescription}`);
          }
      }
      else {
        switch (type) {
          case 'reschedule':
            agent.setContext({name: 'res_awaiting_tracking_number', lifespan: 1}); 
            break;
          case 'cancel':
            agent.setContext({name: 'awaiting_tracking_no_cancel', lifespan: 1});
            break;
          case 'details':
           agent.setContext({name: 'get_appointment_details', lifespan: 1});
        }
        agent.add(`Invalid tracking number. Please enter a valid tracking number`);
        agent.add(new Suggestion(`Cancel`));
      }
      
    }).catch( err => {
        console.log('Error', err);
    });
  }
  
  function cancelAppointment(agent) {
    agent.add('To cancel your appointment you need to have the unique tracking number that was provided to you at the time of booking');
    agent.add('Do you wish to proceed?');
    agent.setContext({name: 'cancel_conversation', lifespan: 1, parameters: {type: 'cancel'}});
  }
  
  function confirmCancelation(agent) {
      let trackingNumber = agent.getContext('cancel_conversation').parameters.trackingNumber;
      trackingNumber = trackingNumber.toUpperCase();
      console.log(trackingNumber);
      return db.ref("Appointments").child(trackingNumber).remove().then(()=>{
      agent.add(`Your appointment has been successfully canceled`);
      }).catch((err)=>{
      console.log("Error", err);
      });
  }
  
  function appointmentDetails(agent) {
    agent.add('To know the details of your appointment enter the tracking number that was provided at the time of booking');
    agent.setContext({name: 'cancel_conversation', lifespan: 1, parameters: {type: 'details'}});
  }
  
  function cancelConversation(agent) {
    agent.add(`Canceled`);
    let type = agent.getContext('cancel_conversation').parameters.type;
    switch (type) {
      case 'booking':
        agent.add(`Your appointment is not booked`);
        break;
      case 'reschedule':
        agent.add(`Your appointment has not been rescheduled`);
        break;
      case 'cancel':
        agent.add(`Your appointment is still active`);
    }
    agent.add(`What would you like to do next?`);
    agent.add(new Suggestion(`Book`));
    agent.add(new Suggestion(`Reschedule`));
    agent.add(new Suggestion(`Cancel`));
    agent.add(new Suggestion(`Get Details`));
  }

  let intentMap = new Map();
  
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  
  intentMap.set('book appointment', bookAppointment);
  intentMap.set('provide model number', modelNumber);
  intentMap.set('provide serial number', serialNumber);
  intentMap.set('provide user name', userName);
  intentMap.set('provide email', email);
  intentMap.set('provide phone number', phoneNumber);
  intentMap.set('provide pincode', pincode);
  intentMap.set('provide schedule time', scheduleTime);
  intentMap.set('provide description', provideDescription);
  intentMap.set('provide booking confirmation', provideBookingConfirmation);
  
  intentMap.set('reschedule appointment', rescheduleAppointment);
  intentMap.set('rescheduling tracking no',validateTrackingNumber);
  intentMap.set('provide reschedule time', rescheduleTime);
  intentMap.set('appointment rescheduled', appointmentRescheduled);
  
  intentMap.set('cancel appointment', cancelAppointment);
  intentMap.set('provide cancelation tracking no', validateTrackingNumber);
  intentMap.set('confirm cancelation', confirmCancelation);
  
  intentMap.set('appointment details', appointmentDetails);
  intentMap.set('get appointment details', validateTrackingNumber);
  
  intentMap.set('cancel conversation', cancelConversation);
  
  agent.handleRequest(intentMap);
});
