const stringReplaceAsync = require('string-replace-async');
const path = require('path');

module.exports = app => {
   /**
   * Make replacements in the text. This step covers things like reading
   * meta-tags, saving data, and adding MUSHCode before the file is compressed.
   * this is the layer that will probably be modified the most.
   */
  app.queue('render')
    .addJob('start', data => {
      data.log('Beginning Render Process '.padEnd(68,'-'));
    })    

    .addJob('headers', data => {
      const regString = `#(${data.validHeaders.join('|')})\\s+(.*)\\n`
      const regex = new RegExp(`${regString}`, 'igm')
      data.txt = data.txt.replace(regex, (...args) => {
        data.headers.push({name:args[1], value:args[2]})
        return ''
      })
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
            data.path = path.join(data.baseDir, args[1]);;
            let fileContents = '';
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
          data.error(error)
        }
      }
      data.txt = contents;
    })
    
    .addJob('custom-headers', data => {
      data.txt = data.txt.replace(/^#header\s+(.*)\s+=\s+(.*)/igm, (...args) => {
        data.headers.push({name:args[1],value:args[2]})
        return ''
      })

    });
}