const queue = require('mu-queue');


class Formatter {
  constructor(){
    this.headers = [];
    this.text = '';
    this.queue = queue;
    this.validHeaders = new Set();
    this.header = '';
    this.footer = '';
    this.log = [];
  }

  setHeaders(headers) {
    const set = new Set(headers.split(' '));
    for (const header in set) {
      this.validHeaders.add(header);
    } 
  }

  format(input)


}