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

    // Capture defines
    .addJob('register-defines', data => {
      data.vars.defs = new Map()
      data.txt
        .replace(/#def\s(.*)((?:[\s\S](?!#enddef))*)/gi, (...args) => {
          data.vars.defs.set(args[1].trim(), args[2].trim())
        })
    })

    // Handle defines
    .addJob('handle-defines', data => {  
      
      // work through data.txt recursion limit number of times to replace nested
      // defines within defines, etc.
      const replaceDefines = (recLimit, data ) => {
        let i = 0
        while (i < recLimit) {
          for (const [pattern, value] of data.vars.defs) {
            data.txt = data.txt.replace(new RegExp(`${pattern}`, 'g'), (...args) => {
              let registers = args
              return value.replace(/\$([0-9])/g, (...args) => {
                return registers[parseInt(args[1])].trim()
              })
            })
          }
          i++
        }
        return data.txt.replace(/#def\s(.*)((?:[\s\S](?!#enddef))*)/gi, '')
      }

      // Kick off the recursion loop
      data.txt = replaceDefines((data.options.defRecLimit || 2), data)
        .replace(/^\/\*[\s\S]*?\*\/|([^\:]|^)\/\/.*/igm, '')
    })

    // Capture headers
    .addJob('register-headers', data => {
      data.vars.headers = []
      data.txt = data.txt.replace(/^#header\s+?(.*)\s*?=\s*?(.*)$/igm, (...args) => {
        data.vars.headers.push({name:args[1],value:args[2]})
        return ''
      })

    })

    // Capture footers
    .addJob('register-footers', data => {
      data.vars.footers = []
      data.txt = data.txt.replace(/^#footer\s+(.*)\s*?=\s*?(.*)$/igm, (...args) => {
        data.vars.footers.push({name:args[1],value:args[2]})
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
          data.log(`Rendering file: ${path.resolve(data.path).replace(/^.*repos(.*)/,'$1')}`)
          let file = await app.queue('open').jobs.get('open-file')(data)

          //prepend every line of the file with escapes (@@)
          return file.split(/\n|\r\n|\r/).map(line => `@@ ${line}`).join('\n')

        } catch (error) {
          data.error(error)
        }
      })
    })
}