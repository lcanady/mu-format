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
      data.log('Beginning Render Process');
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
      
      data.txt = await stringReplaceAsync(data.txt, /^#file\s+(.*)$/igm, async (...args) =>{
        data.path = path.join(data.baseDir, args[1])
        try {
          // attempt to open the file.
          data.log(`Rendering: ${path.resolve(data.path)}`)
          let file = await app.queue('open').jobs.get('open-file')(data)

          //prepend every line of the file with escapes (@@)
          return file.replace(/^(.*)$/mg, (...args) => {
            return `@@ ${args[1]}\n-\n`
          })

        } catch (error) {
          data.error(error)
        }
      })
    })
    
    .addJob('custom-headers', data => {
      data.txt = data.txt.replace(/^#header\s+(.*)\s+?=\s+?(.*)$/igm, (...args) => {
        data.headers.push({name:args[1],value:args[2]})
        return ''
      })

    });
}