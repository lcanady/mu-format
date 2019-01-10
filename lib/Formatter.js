const queue = require('mu-queue');
const path =  require('path');
const fs = require('fs');
const {promisify} = require('util');
const {EventEmitter} = require('events');

class Formatter extends EventEmitter {
  constructor(){
    super();
    this.headers = [];
    this.text = '';
    this.queue = queue;
    this.validHeaders = new Set();
    this.header = '';
    this.footer = '';
    this.log = [];
  }

  setHeaders(headers) {
    headers = headers.split(' ')
    const set = new Set(headers);
    for (const hdr of set) {
      this.validHeaders.add(hdr);
    } 
  }

  async format(input){
    // figure out the base directory if there is one.
    let baseDir = '';
    
    switch(true) {
      case await this._inputType(input) === 'file':
        baseDir = path.dirname(input);
        break;
    }

    // Create the data object. Later I might turn this into it's own class.
    const data = {
      path: input,
      baseDir: baseDir,
      headers: [],
      validHeaders: Array.from(this.validHeaders),
      fileType: this._inputType,
      done: (text) => this.emit('file-open', text),
      getText: () => this.text,
      setText: text => this.text = text,
      isHeader: header => this.validHeaders.has(header),
      setHeader: header => this.headers.push(header)
    }
      // run the queues.
      this.queue('open').run(data)
      this.on('file-open', async data => {
      
      const formatData = await this.queue('replace').run(data);
      })

  }

 async _inputType(input) {
    const lStatPromise = promisify(fs.lstat)
    const stat = await lStatPromise(input);

    switch(true) {
      case input.match(/^github:.*$/i):
        return 'github';
      case stat.isFile():
        return 'file';
      default: 
        return 'text';
    }

  }

}

module.exports = Formatter;