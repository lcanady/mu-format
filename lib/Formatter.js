const queue = require('mu-queue');
const path =  require('path');
const fs = require('fs');
const {promisify} = require('util');
const {EventEmitter} = require('events');

/** Create a new formatter class */
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

  /**
   * Add new valid headers to the format library.
   * @param {string} headers A space seperated list of headers without the
   * hash '#' that the system will see as valid. 
   */
  setHeaders(headers) {
    headers = headers.split(' ')
    const set = new Set(headers);
    for (const hdr of set) {
      this.validHeaders.add(hdr);
    } 
  }

  /**
   * Format a string down to something that can be quoted through a MU* Client.
   * @param {string} input The address, directory, or string to be formatted. 
   */
  async format(input){
    // figure out the base directory if there is one.
    let baseDir = '';
    const inputType = await this._inputType(input)
    let type;

    switch(true) {
      case  inputType === 'file':
        type = 'file';
        baseDir = path.dirname(input);
        break;
      case inputType === 'github':
          type = 'github';
        break;
      case inputType === 'directory':
        baseDir = input;
          type = 'directory';
          break;
      default:
        type = 'text';  
    }

    // Create the data object. Later I might turn this into it's own class.
    const data = {
      path: input,
      baseDir: baseDir,
      headers: [],
      type,
      validHeaders: Array.from(this.validHeaders),
      done: (name, data) => this.emit(name, data)
    }
      // run the queues.
      this.queue('open').run(data)
      this.on('file-open', async data => {
      
      await this.queue('replace').run(data);
      const formatData = await this.queue('compress').run(data);
      console.log(formatData.value.txt)
      })

  }

 async _inputType(input) {
    const lStatPromise = promisify(fs.lstat)
    
    try {
      const stat = await lStatPromise(input);
      switch (true) {
        case stat.isDirectory():
          return 'directory';
        case stat.isFile():
          return 'file';
      }
    } catch (error) {
      switch(true) {
        case input.match(/github.*/i).length > 0:
          return 'github';
        default: 
          return 'text';
      } 
    }

  }

}

module.exports = Formatter;