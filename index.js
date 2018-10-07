'use strict';
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

admin.initializeApp(functions.config().firebase);
const db = admin.database();

process.env.SENDGRID_API_KEY = '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';

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {

  let parameters = request.body.queryResult.parameters;
  let action = request.body.queryResult.action;
  let sessionId = request.body.session;
  let inputContexts = request.body.queryResult.outputContexts;
  let fulfillmentMessages = [];
  let outputContexts = [];

  switch (action) {
    case 'default.welcome.intent':
      handleWelcomeIntent();
      break;
    case 'default.fallback.intent':
      handleFallbackIntent();
      break;
    case 'book.appointment':
      handleBookAppointment();
      break;
    case 'provide.model.number':
      validateModelNumber();
      break;
    case 'provide.serial.number':
      validateSerialNumber();
      break;
    case 'provide.user.name':
      validateUserName();
      break;
    case 'provide.email':
      validateEmail();
      break;
    case 'provide.phone.number':
      validatePhoneNumber();
      break;
    case 'provide.pincode':
      validatePincode();
      break;
    case 'provide.schedule.time':
      validateScheduleTime();
      break;
    case 'provide.description':
      handleDescription();
      break;
    case 'provide.booking.confirmation':
      handleBookingConfirmation();
      break;
    case 'reschedule.appointment':
      handleRescheduleAppointment();
      break;
    case 'provide.tracking.number':
      validateTrackingNumber();
      break;
    case 'send.email':
      handleSendEmail();
      break;
    case 'provide.reschedule.time':
      validateRescheduleTime();
      break;
    case 'appointment.rescheduled':
      handleAppointmentRescheduled();
      break;
    case 'cancel.appointment':
      handleCancelAppointment();
      break;
    case 'confirm.cancelation':
      handleConfirmCancelation();
      break;
    case 'appointment.details':
      handleAppointmentDetails();
      break;
    case 'cancel.conversation':
      handleCancelConversation();
      break;
    default:
      console.log('Error: Action not matched');
      sendResponse();
  }
  
  function handleWelcomeIntent() {
    addTextMessage(`Hi there! I am a chatbot for GE Appliance and I can help you book service appointments, reschedule or cancel your appointment. You can also get the details of your last appointment`);
    addQuickReplies(['Book', 'Reschedule', 'Cancel', 'Get Details']);
    sendResponse();
  }

  function handleFallbackIntent() {
    addTextMessage(`Sorry! I didn't get that`);
    addQuickReplies(['Book', 'Reschedule', 'Cancel', 'Get Details']);
    sendResponse();
  }

  function handleBookAppointment() {
    addTextMessage(`To book a service appointment you need to have the model number and the serial number of the appliance with you`);
    addTextMessage(`Do you wish to proceed?`);
    setContext({
      name: `${sessionId}/contexts/cancel_conversation`,
      lifespanCount: 1,
      parameters: {
        type: 'booking'
      }
    });
    sendResponse();
  }

  function validateModelNumber() {
    let modelNumber = parameters.modelNumber;
    modelNumber = modelNumber.toUpperCase();
    db.ref("boughtAppliances").orderByChild("Model Number").equalTo(modelNumber).once("value").then(snapshot => {
      if (snapshot.exists()) {
        addTextMessage(`Enter the serial number of the appliance`);
        setContext({
          name: `${sessionId}/contexts/awaiting_serial_number`,
          lifespanCount: 1,
          parameters: {
            modelNumber: modelNumber
          }
        });
      } else {
        addTextMessage(`Invalid model number. Please enter a valid model number`);
        addQuickReplies(['Cancel']);
        setContext({
          name: `${sessionId}/contexts/awaiting_model_number`,
          lifespanCount: 1
        });
      }
      sendResponse();
    }).catch(err => {
      console.log('Error', err);
    });
  }

  function validateSerialNumber() {
    let serialNumber = parameters.serialNumber;
    let modelNumber = getContext('cancel_conversation').parameters.modelNumber;
    serialNumber = serialNumber.toUpperCase();
    modelNumber = modelNumber.toUpperCase();
    console.log(serialNumber);
    console.log(modelNumber);
    db.ref("boughtAppliances").orderByChild("Serial Number").equalTo(serialNumber).once("value").then(snapshot => {
      if (snapshot.exists()) {
        let data;
        snapshot.forEach(snap => {
          data = snap.val();
        });
        if (data["Model Number"] !== modelNumber) {
          addTextMessage(`Serial number does not correspond to the provided model number.Please enter a valid serial number`);
          addQuickReplies(['Cancel']);
          setContext({
            name: `${sessionId}/contexts/awaiting_serial_number`,
            lifespanCount: 1
          });
        } else {
          addTextMessage(`So you are booking the appointment for your ${data['Product Line']}?`);
          addTextMessage(`Enter ok to continue`);
          setContext({
            name: `${sessionId}/contexts/confirm_appliance`,
            lifespanCount: 1
          });
          setContext({
            name: `${sessionId}/contexts/cancel_conversation`,
            lifespanCount: 1,
            parameters: {
              appliance: data['Product Line']
            }
          });
        }
      } else {
        addTextMessage(`Invalid serial number. Please enter a valid serial number`);
        addQuickReplies(['Cancel']);
        setContext({
          name: `${sessionId}/contexts/awaiting_serial_number`,
          lifespanCount: 1
        });
      }
      sendResponse();
    }).catch(err => {
      console.log('Error', err);
    });
  }

  function validateUserName() {
    let regex = /^[a-zA-Z]+(([',. -][a-zA-Z ])?[a-zA-Z]*)*$/g;
    let userName = parameters.userName;
    console.log(userName);
    if (regex.test(userName)) {
      addTextMessage(`Enter your email address`);
      setContext({
        name: `${sessionId}/contexts/awaiting_email`,
        lifespanCount: 1
      });
    } else {
      addTextMessage(`Name should only contain letters and spaces. Try again`);
      addQuickReplies(['Cancel']);
      setContext({
        name: `${sessionId}/contexts/awaiting_user_name`,
        lifespanCount: 1
      });
    }
    sendResponse();
  }

  function validateEmail() {
    let email = parameters.email;
    let regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/igm;
    if (regex.test(String(email).toLowerCase())) {
      addTextMessage(`Enter you phone number`);
      setContext({
        name: `${sessionId}/contexts/awaiting_phone_number`,
        lifespanCount: 1
      });
    } else {
      addTextMessage(`Email address is not valid. Try again`);
      addQuickReplies(['Cancel']);
      setContext({
        name: `${sessionId}/contexts/awaiting_email`,
        lifespanCount: 1
      });
    }
    sendResponse();
  }

  function validatePhoneNumber() {
    let regex = /^[0-9]{10}$/;
    let phoneNumber = parameters.phoneNumber;
    if (regex.test(phoneNumber)) {
      addTextMessage(`Enter the address`);
      setContext({
        name: `${sessionId}/contexts/awaiting_address`,
        lifespanCount: 1
      });
    } else {
      addTextMessage(`Invalid phone number. Enter a 10 digit phone number with no special characters.`);
      addQuickReplies(['Cancel']);
      setContext({
        name: `${sessionId}/contexts/awaiting_phone_number`,
        lifespanCount: 1
      });
    }
    sendResponse();
  }

  function validatePincode() {
    let regex = /^[1-9][0-9]{5}$/;
    let pincode = parameters.pincode;
    if (regex.test(pincode)) {
      let schedules = generateSchedules();
      setContext({
        name: `${sessionId}/contexts/awaiting_schedule_time`,
        lifespanCount: 1,
        parameters: schedules
      });
    } else {
      addTextMessage(`Invalid Pin Code. It should only contain 6 digits. Try again`);
      addQuickReplies(['Cancel']);
      setContext({
        name: `${sessionId}/contexts/awaiting_pincode`,
        lifespanCount: 1
      });
    }
    sendResponse();
  }

  function validateScheduleTime() {
    let scheduleTime = parameters.scheduleTime;
    let schedules = getContext('awaiting_schedule_time').parameters;
    if ((schedules.schedule1 === scheduleTime || schedules.schedule2 === scheduleTime || schedules.schedule3 === scheduleTime)) {
      addTextMessage(`Write the description of the issue you are facing with the appliance`);
      setContext({
        name: `${sessionId}/contexts/awaiting_description`,
        lifespanCount: 1
      });
    } else {
      addTextMessage(`You can only choose one of the provided schedule`);
      addQuickReplies([schedules.schedule1, schedules.schedule2, schedules.schedule3, 'Cancel']);
      setContext({
        name: `${sessionId}/contexts/awaiting_schedule_time`,
        lifespanCount: 1
      });
    }
    sendResponse();
  }

  function validateRescheduleTime() {
    let scheduleTime = parameters.scheduleTime;
    let schedules = getContext('awaiting_reschedule_time').parameters;
    if ((schedules.schedule1 === scheduleTime || schedules.schedule2 === scheduleTime || schedules.schedule3 === scheduleTime)) {
      addTextMessage(`Your appointment will be changed to ${scheduleTime}. Do you confirm?`);
      addQuickReplies(['Confirm', 'Cancel']);
      setContext({
        name: `${sessionId}/contexts/change_schedule`,
        lifespanCount: 1
      });
    } else {
      addTextMessage(`You can only choose one of the provided schedule`);
      addQuickReplies([schedules.schedule1, schedules.schedule2, schedules.schedule3, 'Cancel']);
      setContext({
        name: `${sessionId}/contexts/awaiting_reschedule_time`,
        lifespanCount: 1
      });
    }
    sendResponse();
  }

  function generateSchedules() {
    let schedules = {};
    let schedule1 = generateScheduleTime();
    let schedule2 = generateScheduleTime();
    let schedule3 = generateScheduleTime();
    addTextMessage(`Choose one of the time slots available for the service appointment`);
    addQuickReplies([schedule1, schedule2, schedule3]);
    schedules.schedule1 = schedule1;
    schedules.schedule2 = schedule2;
    schedules.schedule3 = schedule3;
    return schedules;
  }

  function generateScheduleTime() {
    let date = 1 + Math.floor(Math.random() * 30);
    let day = ['Mon', 'Tue', 'Wed', 'Thru', 'Fri', 'Sat', 'Sun'];
    let time = ['10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM'];
    let a = Math.floor(Math.random() * 7);
    let schedule = day[a] + " " + date + " " + time[a] + " - " + time[a + 3];
    return schedule;
  }

  function handleDescription() {
    addTextMessage(`Great! We have all the information that we need`);
    let parameters = getContext('cancel_conversation').parameters;
    addTextMessage(`Name:  ${parameters.userName}\nEmail:  ${parameters.email}\nPhone Number:  ${parameters.phoneNumber}\nAddress:  ${parameters.address}\nPin Code:  ${parameters.pincode}\nAppliance:  ${parameters.appliance}\nModel Number:  ${parameters.modelNumber}\nSerial Number:  ${parameters.serialNumber}\nAppointment Schedule:  ${parameters.scheduleTime}\nIssue Description:  ${parameters.description}`);
    addQuickReplies(['Confirm booking', 'Cancel booking']);
    setContext({
      name: `${sessionId}/contexts/awaiting_booking_confirmation`,
      lifespanCount: 1
    });
    sendResponse();
  }

  function handleBookingConfirmation() {
    let parameters = getContext('cancel_conversation').parameters;
    let trackingNumber = Math.random().toString(36).substr(2, 7);
    trackingNumber = trackingNumber.toUpperCase();
    parameters.trackingNumber = trackingNumber;
    let userInfo = {
      trackingNumber: trackingNumber,
      userName: parameters.userName,
      email: parameters.email,
      phoneNumber: parameters.phoneNumber,
      address: parameters.address,
      pincode: parameters.pincode,
      appliance: parameters.appliance,
      modelNumber: parameters.modelNumber.toUpperCase(),
      serialNumber: parameters.serialNumber.toUpperCase(),
      scheduleTime: parameters.scheduleTime,
      issueDescription: parameters.description
    };
    db.ref(`Appointments/${trackingNumber}`).set(userInfo)
      .then(() => {
        sendEmail(userInfo);
        addTextMessage(`Appointment successfully booked. Your appointment details are sent to your email address`);
        addTextMessage(`${trackingNumber} is your unique tracking number. You can use it to check the details of your appointment. It can also be used to reschedule or cancel your appointment`);
        sendResponse();
      })
      .catch(error => {
        console.error("Error writing user details: ", error);
      });
  }

  function sendEmail(userInfo) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
      to: userInfo.email,
      from: 'adityaviki01@gmail.com',
      subject: 'Your Service Appointment Details - GE Appliances',
      html: `<h2>Greetings from GE appliances. Here are the details of your appointment</h2><br>
        <h3>Tracking Number: ${userInfo.trackingNumber}</h3><br>
        Name:  ${userInfo.userName}<br>
        Email:  ${userInfo.email}<br>
        Phone Number:  ${userInfo.phoneNumber}<br>
        Address:  ${userInfo.address}<br>
        Pin Code:  ${userInfo.pincode}<br>
        Appliance:  ${userInfo.appliance}<br>
        Model Number:  ${userInfo.modelNumber}<br>
        Serial Number:  ${userInfo.serialNumber}<br>
        Appointment Schedule:  ${userInfo.scheduleTime}<br>
        Issue Description:  ${userInfo.issueDescription}`
    };
    sgMail.send(msg);
  }

  function handleRescheduleAppointment() {
    addTextMessage(`To reschedule your appointment, You can choose to enter the tracking number or your email address`);
    addQuickReplies(['Enter tracking No', 'Enter email', 'Cancel']);
    setContext({
      name: `${sessionId}/contexts/cancel_conversation`,
      lifespanCount: 1,
      parameters: {
        type: 'reschedule'
      }
    });
    sendResponse();
  }

  function handleAppointmentRescheduled() {
    let parameters = getContext('cancel_conversation').parameters;
    let trackingNumber = parameters.trackingNumber;
    let rescheduleTime = parameters.scheduleTime;
    trackingNumber = trackingNumber.toUpperCase();
    db.ref(`Appointments/${trackingNumber}`).once('value').then(snapshot => {
      let parameters = snapshot.val();
      snapshot.ref.update({
        scheduleTime: rescheduleTime
      });
      addTextMessage(`Your appointment has been rescheduled`);
      addTextMessage(`Here's the details of your appointment`);
      addTextMessage(`Name:  ${parameters.userName}\nEmail:  ${parameters.email}\nPhone Number:  ${parameters.phoneNumber}\nAddress:  ${parameters.address}\nPin Code:  ${parameters.pincode}\nAppliance:  ${parameters.appliance}\nModel Number:  ${parameters.modelNumber}\nSerial Number:  ${parameters.serialNumber}\nAppointment Schedule:  ${parameters.scheduleTime}\nIssue Description:  ${parameters.issueDescription}`);
      sendResponse();
    }).catch((err) => {
      console.log('Error', err);
    });
  }

  function validateTrackingNumber() {
    let trackingNumber = parameters.trackingNumber;
    let type = getContext('cancel_conversation').parameters.type;
    trackingNumber = trackingNumber.toUpperCase();
    db.ref(`Appointments/${trackingNumber}`).once("value").then(snapshot => {
      if (snapshot.exists()) {
        switch (type) {
          case 'reschedule':
            {
              let schedules = generateSchedules();
              setContext({
                name: `${sessionId}/contexts/awaiting_reschedule_time`,
                lifespanCount: 1,
                parameters: schedules
              });
              setContext({
                name: `${sessionId}/contexts/cancel_conversation`,
                lifespanCount: 1,
              });
              break;
            }
          case 'cancel':
            addTextMessage(`Are you Sure you want to cancel your appointment?`);
            addQuickReplies(['Confirm', 'Cancel']);
            setContext({
              name: `${sessionId}/contexts/confirm_cancelation`,
              lifespanCount: 1
            });
            setContext({
                name: `${sessionId}/contexts/cancel_conversation`,
                lifespanCount: 1,
              });
            break;
          case 'details':
            {
              addTextMessage(`Here is all the details of your appointment`);
              let parameters = snapshot.val();
              addTextMessage(`Name:  ${parameters.userName}\nEmail:  ${parameters.email}\nPhone Number:  ${parameters.phoneNumber}\nAddress:  ${parameters.address}\nPin Code:  ${parameters.pincode}\nAppliance:  ${parameters.appliance}\nModel Number:  ${parameters.modelNumber}\nSerial Number:  ${parameters.serialNumber}\nAppointment Schedule:  ${parameters.scheduleTime}\nIssue Description:  ${parameters.issueDescription}`);
            }
        }
      } else {
        addTextMessage(`Invalid tracking number. If you have lost your tracking number your can enter you email and we can send you the tracking number at your email address`);
        addQuickReplies(['Enter tracking number', 'Enter Email', 'Cancel']);
        setContext({
          name: `${sessionId}/contexts/enter_tracking_number`,
          lifespanCount: 1
        });
        setContext({
          name: `${sessionId}/contexts/enter_email`,
          lifespanCount: 1
        });
        setContext({
          name: `${sessionId}/contexts/cancel_conversation`,
          lifespanCount: 1  
        });
      }
      sendResponse();
    }).catch(err => {
      console.log('Error', err);
    });
  }

  function handleSendEmail() {
    let email = parameters.email;
    let regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/igm;
    if (regex.test(String(email).toLowerCase())) {
      db.ref('Appointments').orderByChild('email').equalTo(email).once("value").then(snapshot => {
        if (snapshot.exists()) {
          let count = 0;
          snapshot.forEach(snap => {
            count += 1;
            sendEmail(snap.val());
          });
          if(count == 1)
            addTextMessage(`Your appointment details and tracking number are sent to your email`);
          else
            addTextMessage(`You seem to have multiple appointments associalted with this email. All your appointments and their respective tracking number are sent to your email`);
        } else {
          addTextMessage(`No appointment associated with this email. Enter a valid email`);
          addQuickReplies(['Cancel']);
          setContext({
            name: `${sessionId}/contexts/send_email`,
            lifespanCount: 1
          });
        }
        sendResponse();
      }).catch((err) => {
        console.log('Error', err);
      });
    } else {
      addTextMessage(`Email address not valid. Enter a valid email`);
      addQuickReplies(['Cancel']);
      setContext({
        name: `${sessionId}/contexts/send_email`,
        lifespanCount: 1
      });
      sendResponse();
    }
  }

  function handleCancelAppointment() {
    addTextMessage('To cancel your appointment you can choose to enter the tracking number or your email address');
    addQuickReplies(['Enter tracking no', 'Enter email', 'cancel']);
    setContext({
      name: `${sessionId}/contexts/enter_tracking_number`,
      lifespanCount: 1,
    });
    setContext({
      name: `${sessionId}/contexts/cancel_conversation`,
      lifespanCount: 1,
      parameters: {
        type: 'cancel'
      }
    });
    setContext({
      name: `${sessionId}/contexts/enter_email`,
      lifespanCount: 1,
    });
    sendResponse();
  }

  function handleConfirmCancelation() {
    let trackingNumber = getContext('cancel_conversation').parameters.trackingNumber;
    trackingNumber = trackingNumber.toUpperCase();
    db.ref(`Appointments/${trackingNumber}`).remove().then(() => {
      addTextMessage(`Your appointment has been successfully canceled`);
      sendResponse();
    }).catch((err) => {
      console.log("Error", err);
    });
  }

  function handleAppointmentDetails() {
    addTextMessage('To know your appointment details you can choose to enter the tracking number or your email address');
    addQuickReplies(['Enter tracking no', 'Enter email', 'cancel']);
    setContext({
      name: `${sessionId}/contexts/cancel_conversation`,
      lifespanCount: 1,
      parameters: {
        type: 'details'
      }
    });
    sendResponse();
  }

  function handleCancelConversation() {
    addTextMessage(`Canceled`);
    let type = getContext('cancel_conversation').parameters.type;
    switch (type) {
      case 'booking':
        addTextMessage(`Your appointment is not booked`);
        break;
      case 'reschedule':
        addTextMessage(`Your appointment has not been rescheduled`);
        break;
      case 'cancel':
        addTextMessage(`Your appointment is still active`);
    }
    addTextMessage(`What would you like to do next?`);
    addQuickReplies(['Book', 'Reschedule', 'Cancel Appointment', 'Get Details']);
    sendResponse();
  }

  function getContext(contextName) {
    let context = {};
    inputContexts.forEach((snap) => {
      if (snap.name === `${sessionId}/contexts/${contextName}`)
        context = snap;
    });
    return context;
  }

  function addTextMessage(textMessage) {
    fulfillmentMessages.push({
      "text": {
        "text": [textMessage]
      }
    });
  }

  function addQuickReplies(replies) {
    fulfillmentMessages.push({
      "quickReplies": {
        "quickReplies": replies
      }
    });
  }

  function setContext(context) {
    outputContexts.push(context);
  }

  function sendResponse() {
    response.send({
      'fulfillmentMessages': fulfillmentMessages,
      'outputContexts': outputContexts
    });
  }
});
