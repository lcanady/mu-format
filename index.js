const queue = require('mu-queue');
const path =  require('path');
const fs = require('fs');
const {promisify} = require('util');
const {EventEmitter} = require('events');
const _ = require('lodash');

/** Create a new formatter class */
class Formatter extends EventEmitter {
  
  /**
   * 
   * @param {object} options Aditional params set at creation.
   * @param {string=} options.config Optional configuration params.
   * @param {Array=} options.plugins Plugins passed at creation.
   * @param {string=} options.headers Optional headers recognized when
   * the formatter runs.
   */
  constructor(options={}){
    super(options);
    this.queue = queue;
    this.options = options
    this.gitUser = options.gitUser || ''
    this.gitPass = options.gitPass || ''

    if (options.plugins) this.plugins(options.plugins);
  }

  /**
   * Format a string down to something that can be quoted through a MU* Client.
   * @param {string} input The directory, file or string to be formatted. 
   */
  async format(input, options={}){
    // figure out the base directory if there is one.
    const inputType = await this._inputType(input)
    let type
    let baseDir = ''
    let fileName = ''
    const documents = []
    const log = []

    const logger = message => {
      const d = new Date().toLocaleTimeString()
      log.push(`${d} - ${message}`)
      this.emit('log', `${d} - ${message}`)
    }

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

    // Create the data object.
    const data = {
      path: input,
      baseDir,
      txt:'',
      raw:'',
      fileName,
      cache: new Map(),
      type,
      version: require('./package.json').version,
      vars: {},
      options: this.options,
      inputType: input => this._inputType(input),
      emit: (name, data) => this.emit(name, data),
      error: error => this.emit('error', error),
      log: message => logger(message)
    }

    // Load plugins
    require('./lib/open')(this);
    require('./lib/render')(this);
    require('./lib/compress')(this);
    require('./lib/headerFooter')(this);

    if (options.plugins) {
      // Try loading from runtime options first.
      this.plugins(options.plugins);
    } 

    // run the queues.
    await this.queue('open').job('open')(data)
  
    // Remove the '#include references from data.txt
    data.raw = data.txt.replace(/#include\s.*\n/igm,'')
    await this.queue('pre-render').run(data)
    await this.queue('render').run(data)
    await this.queue('pre-compress').run(data)
    await this.queue('compress').run(data)
    logger('Finalizing')
    await this.queue('header').run(data)
    await this.queue('footer').run(data)
    
    // Push the finished document to the documents collection.
    documents.push({
      fileName: fileName || 'index',
      contents: data.txt,
      raw: data.raw
    })

    logger('Format Complete')
    this.emit('done', documents, this.log)
  }

  /**
   * Load plugin modifications to the queue and parser systems.
   * @param {array} plugins The array of plugins to add.
   */
  plugins(plugins) {
    if (_.isArray(plugins)) {
      this.logger('Begin loading Plugins.');
      plugins.forEach(plugin => {
        try {
          require(plugin)(this);
          this.logger(`Plugin loaded: ${path.resolve(plugin)}`);
        } catch (error) {
          this.emit('error', error);
        }
      })
    this.logger('Plugins loaded')
    } else {
      const err = new Error('Plugins must be an array.');
      this.emit('error', err);
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
        const gitHub = input.match(/^github:.*/i);
        if (gitHub) {
          switch(true) {
            case gitHub.length > 0:
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
