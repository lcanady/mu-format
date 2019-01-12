const queue = require('mu-queue');
const path =  require('path');
const fs = require('fs');
const {promisify} = require('util');
const {EventEmitter} = require('events');
const _ = require('lodash');

/** Create a new formatter class */
class Formatter extends EventEmitter {
  constructor(){
    super();
    this.queue = queue;
    this.validHeaders = new Set();
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
   * Create a log entry of an event.
   * @param {string} message The log message to be recorded.
   */
  logger(message) {
    const d = new Date().toLocaleTimeString();
    this.log.push(`${d} - ${message}`);
    this.emit('log', `${d} - ${message}`);
  }

  /**
   * Format a string down to something that can be quoted through a MU* Client.
   * @param {string} input The address, directory, or string to be formatted. 
   */
  async format(input, options={}){
    // figure out the base directory if there is one.
    let baseDir = '';
    const inputType = await this._inputType(input)
    let type;
    let header = true; 
    let footer = true;

    if (options.noHeader) header = false;
    if (options.noFooter) footer = false;

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
      txt:'',
      cache: new Map(),
      header: '',
      footer: '',
      type,
      validHeaders: Array.from(this.validHeaders),
      emit: (name, data) => this.emit(name, data),
      error: (error,message=null) => this.emit(error, message),
      log: message => this.logger(message)
    }

    // Load plugins
    require('./lib/jobs')(this);
    if (options.plugins) {
      this.plugins(options.plugins);
    }

    // run the queues.
    this.queue('open').run(data);
    this.on('open', async data => {
      
      await this.queue('pre-render').run(data);
      await this.queue('render').run(data);
      await this.queue('compress').run(data);
      
      if (header && data.type !== 'text') await this.queue('header').run(data);
      if (footer && data.type !== 'text') await this.queue('footer').run(data);
      
      const results = data.header + data.txt + data.footer;
      this.emit('done', {document:results, log:this.log});
    })

  }

  /**
   * Load plugin modifications to the queue and parser systems.
   * @param {array} plugins The array of plugins to add.
   */
  plugins(plugins) {
    if (_.isArray(plugins)) {
      this.logger('Begin loading Plugins...');
      plugins.forEach(plugin => {
        try {
          require(plugin)(this);
          this.logger(`Plugin loaded: ${path.resolve(plugin)}`);
        } catch (error) {
          this.emit('error', error);
        }
      })
    this.logger('Plugins loaded..')
    } else {
      const err = new Error('Not an Array');
      this.emit('error', err, 'Plugins must be in an array.');
    }
  }

  /**
   * Test the input from the format command for what the user has entered.
   * @param {string} input The string used when running the format command
   * 
   * @return {string} The type of input we're dealing with.
   */
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
      // If stat fails to run, it's either github or text.      
      try {
        const gitHub = input.match(/github.*/i);
        if (gitHub) {
          switch(true) {
            case input.match(/github.*/i).length > 0:
              return 'github';
            default: 
              return 'text';
          }
        } else {
          return 'text'
        }
      } catch (error) {
        this.emit('error', error);
      }
    }
  }
}

module.exports = Formatter;

const app = new Formatter();
app.format('./examples/');
app.on('log', log => console.log(log))
app.on('done', results => console.log(results.document))