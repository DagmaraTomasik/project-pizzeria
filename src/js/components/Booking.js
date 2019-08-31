import {templates, select, settings, classNames} from '../settings.js';
import {AmountWidget} from './AmountWidget.js';
import {HourPicker} from './HourPicker.js';
import {DatePicker} from './DatePicker.js';
import {utils} from '../utils.js';

export class Booking{
    constructor(bookingElem){
      const thisBooking = this;

      thisBooking.render(bookingElem);
      thisBooking.addTablesListeners();
      thisBooking.initWidgets();
      thisBooking.getData();
    }

    render(bookingElem){
      const thisBooking = this;

      const generatedHTML = templates.bookingWidget();

      thisBooking.dom = {};
      thisBooking.dom.wrapper = bookingElem;
      thisBooking.dom.wrapper.innerHTML = generatedHTML;

      thisBooking.dom.peopleAmount = thisBooking.dom.wrapper.querySelector(select.booking.peopleAmount);
      thisBooking.dom.hoursAmount = thisBooking.dom.wrapper.querySelector(select.booking.hoursAmount);
      thisBooking.dom.datePicker = thisBooking.dom.wrapper.querySelector(select.widgets.datePicker.wrapper);
      thisBooking.dom.hourPicker = thisBooking.dom.wrapper.querySelector(select.widgets.hourPicker.wrapper);
      thisBooking.dom.tables = thisBooking.dom.wrapper.querySelectorAll(select.booking.tables);
      thisBooking.dom.form = thisBooking.dom.wrapper.querySelector(select.booking.form);
      thisBooking.dom.address = thisBooking.dom.wrapper.querySelector(select.booking.address);
      thisBooking.dom.phone = thisBooking.dom.wrapper.querySelector(select.booking.phone);
    }

    addTablesListeners(){
      const thisBooking = this;

      thisBooking.chosenTable = {};

      for(let table of thisBooking.dom.tables) {
        table.addEventListener('click', function() {

          const tableId = parseInt(table.getAttribute('data-table'));
          const hour = utils.hourToNumber(thisBooking.hourPicker.value); //12:00 -> 12
          const date = thisBooking.datePicker.value;

          if(thisBooking.booked[date] && thisBooking.booked[date][hour]) {
            if(thisBooking.booked[date][hour].includes(tableId)) {
              alert('Stolik jest zajęty!');
            } else {
              const activeTable = thisBooking.dom.wrapper.querySelector(select.booking.tables+`[data-table="${thisBooking.chosenTable}"]`);
              if(activeTable)
              activeTable.classList.remove('booked');
              table.classList.add('booked');
              thisBooking.chosenTable = tableId;
            }
          }
        });
      }
    }

  initWidgets(){
    const thisBooking = this;

    thisBooking.peopleAmount = new AmountWidget(thisBooking.dom.peopleAmount);
    thisBooking.hoursAmount = new AmountWidget(thisBooking.dom.hoursAmount);
    thisBooking.datePicker = new DatePicker(thisBooking.dom.datePicker);
    thisBooking.hourPicker = new HourPicker(thisBooking.dom.hourPicker);

    thisBooking.dom.wrapper.addEventListener('updated', function(){
      thisBooking.updateDOM();
    });

    thisBooking.dom.form.addEventListener('submit', function(event){
      event.preventDefault();
      thisBooking.sendBooking();
    });
  }

  getData(){
    const thisBooking = this;

    const startEndDates = {};
    startEndDates[settings.db.dateStartParamKey] = utils.dateToStr(thisBooking.datePicker.minDate);
    startEndDates[settings.db.dateEndParamKey] = utils.dateToStr(thisBooking.datePicker.maxDate);

    const endDate = {};
    endDate[settings.db.dateEndParamKey] = startEndDates[settings.db.dateEndParamKey];

    const params = {
      booking: utils.queryParams(startEndDates),
      eventsCurrent: settings.db.notRepeatParam + '&' + utils.queryParams(startEndDates),
      eventsRepeat: settings.db.repeatParam + '&' + utils.queryParams(endDate),
    };

    console.log('getData params', params);

    const urls = {
      booking: settings.db.url + '/' + settings.db.booking + '?' + params.booking,
      eventsCurrent: settings.db.url + '/' + settings.db.event + '?' + params.eventsCurrent,
      eventsRepeat: settings.db.url + '/' + settings.db.event + '?' + params.eventsRepeat,
    };

    console.log('getData urls', urls);

    Promise.all([
      fetch(urls.booking),
      fetch(urls.eventsCurrent),
      fetch(urls.eventsRepeat),
    ])
    .then(function([bookingsResponse, eventsCurrentResponse, eventsRepeatResponse]){
      return Promise.all([
        bookingsResponse.json(),
        eventsCurrentResponse.json(),
        eventsRepeatResponse.json(),
      ]);
    })
    .then(function([bookings, eventsCurrent, eventsRepeat]){
      thisBooking.parseData(bookings, eventsCurrent, eventsRepeat);
    });
  }

  parseData(bookings, eventsCurrent, eventsRepeat){
    const thisBooking = this;

    thisBooking.booked = {};

    for (let element of eventsCurrent){
      thisBooking.makeBooked(element.date, element.hour, element.duration, element.table);
    };

    for (let element of bookings){
      thisBooking.makeBooked(element.date, element.hour, element.duration, element.table);
    };

    const minDate = thisBooking.datePicker.minDate;
    const maxDate = thisBooking.datePicker.maxDate;

    for(let element of eventsRepeat){
      if(element.repeat == 'daily'){
        for(let loopDate = minDate; loopDate < maxDate; loopDate = utils.addDays(loopDate, 1)){
          thisBooking.makeBooked(utils.dateToStr(loopDate), element.hour, element.duration, element.table);
        }
      }
    };

   thisBooking.updateDOM();

  }

  makeBooked(date, hour, duration, table){
    const thisBooking = this;

    if(typeof thisBooking.booked[date] == 'undefined'){
      thisBooking.booked[date] = {};
    }

    const startHour = utils.hourToNumber(hour);

    for (let hourBlock = startHour; hourBlock < startHour + duration; hourBlock += 0.5){

      if (typeof thisBooking.booked[date][hourBlock] == 'undefined'){
        thisBooking.booked[date][hourBlock] = [];
      }

      thisBooking.booked[date][hourBlock].push(table);
    }
  }

  updateDOM(){
    const thisBooking = this;

    thisBooking.date = thisBooking.datePicker.value;
    thisBooking.hour = utils.hourToNumber(thisBooking.hourPicker.value);

    let allAvailable = false;
    console.log(allAvailable);

    if(typeof thisBooking.booked[thisBooking.date] == 'undefined' || typeof thisBooking.booked[thisBooking.date][thisBooking.hour] == 'undefined'){
      allAvailable = true;
      console.log(allAvailable);
    }

    for(let table of thisBooking.dom.tables){
      let tableId = table.getAttribute(settings.booking.tableIdAttribute);
      if(!isNaN(tableId)){
        tableId = parseInt(tableId);
        console.log(tableId);
      }

      if(!allAvailable && thisBooking.booked[thisBooking.date][thisBooking.hour].includes(tableId)){
        table.classList.add(classNames.booking.tableBooked);
      } else {
        table.classList.remove(classNames.booking.tableBooked);
      }
    }
  }

  sendBooking(){
    const thisBooking = this;

    const url = settings.db.url + '/' + settings.db.booking;

    for(let table of thisBooking.dom.tables){
      if(table.classList.contains('booked')){
        const tableNumber = parseInt(table.getAttribute(settings.booking.tableIdAttribute));
        thisBooking.table = tableNumber;
      }
    }

    const payload = {
      date: thisBooking.datePicker.value,
      hour: thisBooking.hourPicker.value,
      table: thisBooking.table,
      ppl: thisBooking.peopleAmount.value,
      duration: thisBooking.hoursAmount.value,
      phone: thisBooking.dom.phone.value,
      address: thisBooking.dom.address.value,
    };
    console.log('payload:', payload);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    };

    fetch(url, options)
      .then(function(response){
        return response.json();
      })
      .then(function(parsedResponse){
        console.log('parsedResponse:', parsedResponse);
      });
  }
}
