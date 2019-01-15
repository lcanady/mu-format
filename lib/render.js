const stringReplaceAsync = require('string-replace-async');

module.exports = app => {
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
      data.log('Beginning Render Process '.padEnd(68,'-'));
      data.log('Grabbing Headers '.padEnd(68,'-'));
      // create a new regex object from a template string.
      if (data.validHeaders.length > 0) {
        const regex = new RegExp(`#(${headers})\\s+(.*)`, 'i');
        input.split(/\n/).forEach(line => {
          line = line.replace(regex, (...args) => {
            data.headers.push({name:args[1].trim(), value:args[2].trim()});
          });
          if (line !== 'undefined') contents += line +'\n';
        });
        data.txt = contents;
      }   
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
              data.log(`Rendering: ${path.resolve(data.path)}`)
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
}