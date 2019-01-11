const Formatter = require('./lib/Formatter');
const path = require('path');
const app = new Formatter();
const fs = require('fs');
const stringReplaceAsync = require('string-replace-async');
const {promisify} = require('util');
const readFilePromise = promisify(fs.readFile);
const axios = require('axios');

    
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

    /**
     * Check for files to include in the build.
     * @param {string} fileData The contents of the current file.
     */
    const include = async fileData => {
      lines = fileData.split(/\n|\nr|\r/).filter(Boolean).forEach(line =>{
        
        stringReplaceAsync(line, /^#include\s+(.*)$/i,async (...args) => {
          includes++;
          data.path = path.join(data.baseDir, args[1]);
          let file = await app.queue('open').jobs.get('open-file')(data)
          // recursively call the function again to check the next file.
          include(file);
        })

        contents += line +'\n';               
      })
      // If the function has cycles and there is no include, the file is done.
      // Send the info back to the main program to begin formatting.
      finished = count < includes ? false : true;
      if (finished) {
        data.txt = contents;

        // emit an event when the files are done combining.
        data.done('file-open', data);
      }
      count++;
    }

    // open the first file to kick off the process, and send it to includes().
    const file = await app.queue('open').jobs.get('open-file')(data);
    include(file);
  })

  // Open and read and return the contents of a file depending on the request
  // sent.  As of right now a user can enter a github repo 'github:user/repo',
  // a local file/directory, or a string of text.
  .addJob('open-file', async data => {
       
    switch(true){
      case data.type === 'file':
        return await readFilePromise(path.resolve(data.path), 'utf8');
      
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
          const response = await axios.get(url);
          const data = response.data;
          // re-encode to utf8 and return.
          return (new Buffer(data.content, 'base64')).toString('utf8');
        } catch (error) {
          console.log(error);
          break;
        }
      case data.type === 'directory':
        const dir = path.resolve(data.path, 'installer.mux');
        data.type = 'file';
        return await readFilePromise(path.resolve(dir), 'utf8');
    }
  
  });
  
  app.queue('replace')
    
    // save all valid headers set with setHeaders() in a headers array on the
    // data object to be moved to the formatter once processing is complete.
    // if header mode is turne on, they will be displyed at the top of the
    // formatter.
    .addJob('headers', data => {
      let input = data.txt;
      let contents = '';
      const headers = data.validHeaders.join('|');

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
      const regex = new RegExp(
        '\/\\*[\\s\\S]*?\\*\\/|([^\\\\:]|^)\\/\\/.*|<!--[\\s\\S]*?-->$','gm'
      );
      data.txt = data.txt.replace(regex, '');
      data.txt = data.txt.replace(/#include.*/gi, '');
    })


    .addJob('files', async data => {
      let input = data.txt;
      let contents = '';
      
      let lines = input.split(/\n/);
      for (let line of lines) {
        line = await stringReplaceAsync(line, /#file\s+(.*)/i, async (...args) => {
          const dir = path.join(data.baseDir, args[1]);
          data.path = dir;
          fileContents = '';
          let file = await app.queue('open').jobs.get('open-file')(data)
          let fileLines = file.split(/\n/);
          
          for (let line of fileLines) {
            fileContents +='@@ ' + line +'\n-\n';
          }
          return fileContents
        })
        contents += line + '\n';
      }
     data.txt = contents;
    });

    // jobs related to compressing down the text file into a quotable format.
    app.queue('compress')
      
    .addJob('compress', data => {
      let input = data.txt;
      let contents = '';

      input = input.split(/-\n/).filter(Boolean).forEach(line => {
        line = line.replace(/\s\s+/, ' ');
        contents += line + '\n'; 
      });
      
      data.txt = contents;
    });

  



  app.setHeaders("system author email url file_name");
  app.format('./examples/');
