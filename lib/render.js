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
     
      data.txt = await stringReplaceAsync(data.txt, /^#file\s+(.*)$/igm, async (...args) =>{
        data.path = path.join(data.baseDir, args[1])
        try {
          // attempt to open the file.
          data.log(`Rendering: ${path.resolve(data.path)}`)
          let file = await app.queue('open').jobs.get('open-file')(data)

          //prepend every line of the file with escapes (@@)
          return file.replace(/^(.*)$/mg, (...args) => `@@ ${args[1]}\n` )

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

    })

    .addJob('register-defines', data => {
      data.txt = data.txt.replace(/#def\s(.*)((?:[\s\S](?!#enddef))*)/gi, (...args) => {
        data.defs.set(args[1].trim(), args[2].trim())
        return ''
      })
    })

    .addJob('create-check', data => {
      
      data.txt = data.txt.replace(/#create\s+(.*)\s*?=\s*?(.*)/gi, (...args) => {
          
        return ` 
        @if isdbref(setr(0, locate(me, ${args[1]}, *))) = {
          &${args[2]} me = %q0;
        },
        {
          @create ${args[1]};
          @set ${[args[2]]} = inherit safe;
          &${args[2]} = %q0;
        }; 
        `.trim()
      })
    })
}