const queue = require('mu-queue');
const path =  require('path');
const fs = require('fs');
const {promisify} = require('util');
const {EventEmitter} = require('events');
const _ = require('lodash');

const readFilePromise = promisify(fs.readFile);

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
    this.validHeaders = new Set();
    this.log = [];
    this.documents = [];
    this.config = options.config ? options.config : {};
    if (options.config)  this.configure(this.config);
    if (options.plugins) this.plugins(options.plugins);
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

  async configure(config) {
    try {
      let file = await readFilePromise(config, 'utf8');
      this.config = JSON.parse(file);
    } catch (error) {
      this.emit('error', error);
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
    const inputType = await this._inputType(input)
    let type;
    let header = true; 
    let footer = true;
    let baseDir = '';
    let fileName = '';

    if (options.noHeader || this.config.noHeader) header = false;
    if (options.noFooter || this.config.noFooter) footer = false;

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
      txt:'',
      raw:'',
      fileName: '',
      cache: new Map(),
      config: this.config,
      footer: '',
      type,
      inputType: input => this._inputType(input),
      emit: (name, data) => this.emit(name, data),
      error: (error,message = null) => this.emit(error, message),
      log: message => this.logger(message)
    }

    // Load plugins
    require('./lib/open')(this);
    require('./lib/render')(this);
    require('./lib/compress')(this);
    require('./lib/headerFooter')(this);

    if (options.plugins) {
      // Try loading from runtime options first.
      this.plugins(options.plugins);
    } else if (this.config.plugins) {
      this.plugins(this.config.plugins)
    }

    
    // run the queues.
    this.queue('open').run(data);
    this.on('open', async data => {
      
      // Remove the '#include references from data.txt
      data.raw = data.txt.replace(/#include\s.*\n/igm,'');

      await this.queue('pre-render').run(data);
      await this.queue('render').run(data);
      await this.queue('pre-compress').run(data);
      await this.queue('compress').run(data);
      
      // add footer
      if (footer) await this._custHeaderFooter('footer', data);
      const results = data.txt + '\n\n' + data.footer;
      
      // Push the finished document to the documents collection.
      this.documents.push({
        fileName: fileName || 'main',
        contents: results,
        raw: data.raw
      });
      
      this.emit('done', this.documents);
    });

  }

  async  _custHeaderFooter(input, data) {

    if (input.match(/header|footer/i)) {
      // Process custom headers -> turn this into a private method.
      if (data.type !== 'text') {
        if(this.config[input]) {
          // figure out what kind of data we're working with.
          const inputType = await this._inputType(this.config[input]);
          switch(inputType) {
            case 'file':
              try {
                data.type = 'file';
                data.path = path.join(this.config[input])
                this.logger(`Custom ${input.toLowerCase()}: ${path.resolve(data.path)}`)
                const inputData = await queue('open').job('open-file')(data);
                inputData.split(/\r|\r\n|\n/).forEach(line =>{
                  data[input] += `@@ ${line}\n`                   
                });
                break;

              } catch (error) {
                this.emit('error', error);
                break;
              }
            default:
              this.logger(`Custom ${input.toLowerCase()}: Formatting `.padEnd(68,'-'))
              this.config[input]
                .split(/\r|\r\n|\n/)
                .forEach(line => {
                  data[input] += `@@ ${line}\n`;
                });
          }

        }
        await this.queue(input).run(data);
      }
    }    
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
