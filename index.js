const Formatter = require('./lib/Formatter');
const path = require('path');
const app = new Formatter();
const fs = require('fs');
const stringReplaceAsync = require('string-replace-async');
const {promisify} = require('util');
const readFilePromise = promisify(fs.readFile);

    
app.queue('open')

  // The main job to open all of the included files and combine them.
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
        line = line.replace(/^#include\s+(.*)$/i, async (...args) => {
          includes++;
          data.path = path.resolve(data.baseDir, args[1]);
          let file = await app.queue('open').jobs.get('open-file')(data)
          // recursively call the function again to check the next file.
          include(file);
        });

        // Figure out how to avoid these later. I think it has something to
        // do with the second call of include() when a match is found.
        if (line !== 'undefined' && line !== '[object Promise]') {
          contents += line +'\n';        
        }
      })
      // If the function has cycles and there is no include, the file is done.
      // Send the info back to the main program to begin formatting.
      finished = count < includes ? false : true;
      if (finished) {
        data.txt = contents;
        data.done(data);
      }
      count++;

    }
    // open the first file to kick off the process, and send it to includes().
    const file = await app.queue('open').jobs.get('open-file')(data);
    include(file);
  })

  // Open and read and return the contents of a file.
  .addJob('open-file', async data => {
    return await readFilePromise(data.path, 'utf8');
  });
  
  app.queue('replace')

    .addJob('headers', data => {
      let input = data.txt;
      let contents = '';
      const headers = data.validHeaders.join('|');
      const regex = new RegExp(`#(${headers})\\s+(.*)`, 'i');
      input.split(/\n/).forEach(line => {
        line = line.replace(regex, (...args) => {
          data.headers.push({name:args[1].trim(), value:args[2].trim()});
        });
        if (line !== 'undefined') contents += line +'\n';
      });   
      data.txt = contents;
    })

    .addJob('files', async data => {
      let input = data.txt;
      let contents = '';
      
      let lines = input.split(/\n/);
      for (let line of lines) {
        line = await stringReplaceAsync(line, /#file\s+(.*)/i, async (...args) => {
          const dir = path.resolve(data.baseDir, args[1]);
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
     console.log(contents)
    })
      

  



  app.setHeaders("system author email url file_name");
  app.format('./examples/installer.mux');
