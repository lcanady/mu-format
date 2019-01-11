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
      data.log('Begin Formatting...');
      /**
       * Check for files to include in the build.
       * @param {string} fileData The contents of the current file.
       */
      const include = async fileData => {
        try {
          lines = fileData.split(/\n|\nr|\r/).filter(Boolean).forEach(line =>{
          
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
            data.log('Initial document built...');
            data.emit('open', data);
          }
          count++;
        } catch (error) {
          data.error(error);    
        }
        
      }
      
      try {
        // open the first file to kick off the process, and send it to includes().
        data.log(`Opening: ${path.resolve(data.path)}`)
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
        
      switch(true){
        case data.type === 'file':
          try {
            data.log(`Reading: ${path.resolve(data.path)}`);
            return await readFilePromise(path.resolve(data.path), 'utf8'); 
          } catch (error) {
            data.error(error);
          }
        
        case data.type === 'github':
          
          let url;
          const isNewGit = data.path.match(/^github.*/i);
          if (!data.user || isNewGit) {
            // if this is the first request, go after installer.mux in the
            // repo directory.  If not, append the address and keep downloading.
            const info = data.path.match(/github:(.*)\/(.*)/i);
            data.user = info[1];
            data.repo = info[2];
          
              url = 'https://' + path.join(
              'api.github.com/repos/', 
              data.user, 
              data.repo,
              'contents/installer.mux' 
            );
            data.type = 'github'
            data.baseDir = `api.github.com/repos/${data.user}/` +
            `${data.repo}/contents`        
          } else {
            url ='https://' + data.path;
          } 

          try {
            // Make the api request.
            data.log(`Downloading: ${url}`)
            const response = await axios.get(url);
            const responseData = response.data;
            // re-encode to utf8 and return.
            return (new Buffer(responseData.content, 'base64')).toString('utf8');
          } catch (error) {
            data.error(error);
            break;
          }
        case data.type === 'directory':
          // if it's  directory, look for installer.mux. 
          data.log(`Opening: ${path.resolve(data.path, 'installer.mux')}`)
          const dir = path.resolve(data.path, 'installer.mux');
          data.type = 'file';
          try {
            return await readFilePromise(path.resolve(dir), 'utf8');
          } catch (error) {
            
          }
        case data.type === 'text':
          data.log('Rendering text...');
          return data.path;
      }
    
    });

  /**
   * Make replacements in the text. This step covers things like reading
   * meta-tags, saving data, and adding MUSHCode before the file is compressed.
   * this is the layer that will probably be modified the most.
   */
  app.queue('render')
    
    // save all valid headers set with setHeaders() in a headers array on the
    // data object to be moved to the formatter once processing is complete.
    // if header mode is turne on, they will be displyed at the top of the
    // formatter.
    .addJob('headers', data => {
      let input = data.txt;
      let contents = '';
      const headers = data.validHeaders.join('|');
      data.log('Beginning Render Process...');
      data.log('Grabbing Headers...');
      // create a new regex object from a template string.
      const regex = new RegExp(`#(${headers})\\s+(.*)`, 'i');
      input.split(/\n/).forEach(line => {
        line = line.replace(regex, (...args) => {
          data.headers.push({name:args[1].trim(), value:args[2].trim()});
        });
        if (line !== 'undefined') contents += line +'\n';
      });   
      data.txt = contents;
    })

    // Process any headers set with the #header tag, and add them to the 
    // headers array on the data object.
    .addJob('custom-headers', data => {
      const input = data.txt;
      let contents = '';
      input.split(/\n/).filter(Boolean).forEach(line => {
        line = line.replace(/#header\s+(.*)\s+?=\s+?(.*)/i, (...args) =>{
          data.headers.push({name:args[1], value:args[2]});
        });
        if (line !== 'undefined') contents += line + '\n'
      });
      data.txt = contents;
    })

    // Remove any comments and left over #include tags from the text.
    // Super long regex find for comments: https://bit.ly/2AEtQmS
    .addJob('comments', data => {
      data.log('Removing Comments...');
      const regex = new RegExp(
        '\/\\*[\\s\\S]*?\\*\\/|([^\\\\:]|^)\\/\\/.*|<!--[\\s\\S]*?-->$','gm'
      );
      data.txt = data.txt.replace(regex, '');
      data.txt = data.txt.replace(/#include.*/gi, '');
    })

    // Inject text files into the formatter object.  It reads the file and adds
    // @@ comment delimiters to the beginning of each line, preserving blank
    // lines.
    .addJob('files', async data => {
      let input = data.txt;
      let contents = '';
      
      let lines = input.split(/\n/);
      for (let line of lines) {
        try {
          line = await stringReplaceAsync(line, /#file\s+(.*)/i, async (...args) => {
            const dir = path.join(data.baseDir, args[1]);
            data.path = dir;
            fileContents = '';
            try {
              // attempt to open the file.
              data.log(`Rendering file: ${path.resolve(data.path)}`)
              let file = await app.queue('open').jobs.get('open-file')(data) 
              let fileLines = file.split(/\n/);
              
              // prepend every line with comment symbols
              for (let line of fileLines) {
                fileContents +='@@ ' + line +'\n-\n';
              }
              // return to the main loop.
              return fileContents;
            } catch (error) {
              data.error(error);
            }
          })
          contents += line + '\n'; 
        } catch (error) {
          data.error()
        }
      }
      data.txt = contents;
    });

  /**
   * jobs related to compressing down the text file into a quotable format. 
   */
  app.queue('compress')
    
    .addJob('compress', data => {
      let input = data.txt;
      let contents = [];
      data.log('Compressing document...')
      input = input.split(/\n-\n/).filter(Boolean).map(line =>{
        line = line.replace(/\n/g, ' ') // remove extra newlines
          .replace(/\s\s+/g, ' ') // remove extra spaces
          .replace(/\]\s+\[/, '][') // remove spaces between brackets.
          .replace(/\s?%(r|t)\s?/gi, '%$1') // remove spaces around %subs
          .trim();
        if(line !== '') contents.push(line)
      });
      
      data.txt = contents.join('\n');
    });

  app.queue('header')
    .addJob('header', data => {
      let headers = '';
      data.log('Adding header.')
      data.headers.forEach(header =>{
        headers += `@@ ${header.name.padEnd(20)} ${header.value}\n`;
      })
      data.header = headers + '\n';
    });

    app.queue('footer')
      .addJob('footer', data => {
        data.log('Adding footer...')
        let footer = '\n\n@@\n@@ Formatted with Mu-Format\n';
        footer += '@@ 2019 Lemuel Canady, Jr\n'
        footer += '@@ https://github.com/lcanady/mu-format\n@@\n'
        data.footer = footer;
      });
}