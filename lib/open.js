const path = require('path');
const stringReplaceAsync = require('string-replace-async');
const {promisify} = require('util');
const fs = require('fs');
const axios = require('axios');
const readFilePromise = promisify(fs.readFile);

module.exports = (app) => {

  /** 
   * Open any files related to the build, and stitch them together in a
   * single document. 
   */    
  app.queue('open')

    // The main job to open all of the included files and combine them.
    // It opens the first file, and then sends it into a recursive loop where
    // subsiquent files are loaded.  Once the last include runs the files are
    // combined on the data object and sent back through an 'open-file' event.
    .addJob('open', async data => {
      let contents = '';
      let count = 0;
      let includes = 0;
      let finished = false;
      data.log('Begin Formatting '.padEnd(68,'-'));
      /**
       * Check for files to include in the build.
       * @param {string} fileData The contents of the current file.
       */
      const include = async fileData => {
        try {
          lines = fileData.split(/\n|\nr|\r/).forEach(line =>{
          
            stringReplaceAsync(line, /^#include\s+(.*)$/i,async (...args) => {
              includes++;
              data.log(`Including: ${path.resolve(data.baseDir, args[1])}`)
              data.path = path.join(data.baseDir, args[1]);
              try {
                let file = await app.queue('open').jobs.get('open-file')(data)
                // recursively call the function again to check the next file.
                include(file);
              } catch (error) {
                data.error(error)
              }
            })
  
            contents += line +'\n';               
          })
          // If the function has cycles and there is no include, the file is done.
          // Send the info back to the main program to begin formatting.
          finished = count < includes ? false : true;
          if (finished) {
            data.txt = contents;
  
            // emit an event when the files are done combining.
            data.log('Initial document built '.padEnd(68,'-'));
            data.emit('open', data);
          }
          count++;
        } catch (error) {
          data.error(error);    
        }
        
      }
      
      try {
        // open the first file to kick off the process, and send it to includes().
        data.log(`Opening: ${path.join(data.path)}`)
        const file = await app.queue('open').jobs.get('open-file')(data);
        include(file); 
      } catch (error) {
        data.error(error)
      }
    })

    // Open and read and return the contents of a file depending on the request
    // sent.  As of right now a user can enter a github repo 'github:user/repo',
    // a local file/directory, or a string of text.
    .addJob('open-file', async data => {
      
      if(data.path.match(/^github:/)) data.type = 'github'

      switch(true){
        case data.type === 'file':
        
          // Make sure we're only reading a file once.  Used for the #include
          // tag which can be used more than once in a file.  Dont re-open the
          // file again. 
          if(!data.cache.has(data.path)) {
            try {
              data.log(`Reading: ${path.resolve(data.path)}`);
              data.cache.path = data.path;
              const file = await readFilePromise(path.resolve(data.path), 'utf8'); 
              data.cache.set(data.path, file);
              return file;
            } catch (error) {
              data.error(error);
            }          
          } else {
            data.log(`Reading: ${path.resolve(data.path)}`);
            return data.cache.get(data.path);
          }
        
        case data.type === 'github':
          
          let url;
          const isNewGit = data.path.match(/^github.*/i);
          if (!data.user || isNewGit) {
            // if this is the first request, go after installer.mu in the
            // repo directory.  If not, append the address and keep downloading.
            const info = data.path.match(/github:(.*)\/(.*)/i);
            data.user = info[1];
            data.repo = info[2];
          
              url = 'https://' + path.join(
              'api.github.com/repos/', 
              data.user, 
              data.repo,
              'contents/installer.mu' 
            );
            data.type = 'github'
            data.baseDir = `api.github.com/repos/${data.user}/` +
            `${data.repo}/contents`        
          } else {
            url ='https://' + data.path;
          } 
          url = url.replace(/\s/g,'');
          // Make sure we're not downloading a file from github more than
          // once per build.
          if (!data.cache.has(url)) {
            try {
              // Make the api request.
              data.log(`Downloading: ${url}`)
              data.cache.url = url;
              const response = await axios.get(url);
              
              const responseData = response.data;
              // re-encode to utf8 and return.
              const file = (new Buffer(responseData.content, 'base64')).toString('utf8');

              data.cache.set(url, file);
              return file;
            } catch (error) {
              data.error(error);
              break;
            }
          } else {
            data.log(`Reading file: ${url}`)
            return data.cache.get(url);
          }
          
        case data.type === 'directory':
          // if it's  directory, look for installer.mux. 
          data.log(`Opening: ${path.resolve(data.path, 'installer.mu')}`)
          const dir = path.resolve(data.path, 'installer.mu');
          data.type = 'file';
          try {
            return await readFilePromise(path.resolve(dir), 'utf8');
          } catch (error) {
            
          }
        case data.type === 'text':
          data.log('Rendering text '.padEnd(68,'-'));
          return data.path;
      }
    
    })
}