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
          return '\n-\n' + file.replace(/^(.*)$/mg, (...args) => `@@ ${args[1]}\n` ) + '\n-\n'

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
      
      let objs = new Map()
      const replaceNames = new Map();
    
      data.txt = data.txt.replace(/#create\s+(.*)\s*?=\s*?(.*)/gi, (...args) => {
        
        // Check to see if the value of #create mathes a original reference /installer
        // name pattern. If so substitute the working name of object references
        // with the reference to be used in the installer.
        const match = args[2].match(/\s*?(.*)\/(.*)\s*?/)
        let installName;
        if (match) {
          installName = match[2]
          replaceNames.set(match[1], match[2])
          objs.set(args[1], match[2])
        } else {
          objs.set(args[1],args[2])
          installName = args[2]
        }
        
        return ` 
        @if isdbref(setr(0, locate(me, ${args[1]}, *))) = {
          &${installName} me = %q0;
        },
        {
          @create ${args[1]};
          @set ${installName} = inherit safe;
          &${installName} = %q0;
        }; 
        `.trim()
      })
      
      // replace name references if needed.
      const replaceRegex = Array.from(replaceNames.keys()).join('|')
      if(replaceRegex) {
        data.txt = data.txt.replace(new RegExp(`${replaceRegex}`, 'gi'), (...args) => {
          return ' ' + replaceNames.get(args[0]) + ' '
        })
      }
    })

    .addJob('add-ufuns', data => {
    
      data.txt.replace(/#ufuns\s+?(.*)/gi, (...args) => {
        let ufuns = `@dolist lattr(${args[1]}/ufun.*) = ` + 
        `@function [after(##,UFUN.)] = ${args[1]}/##;\n` + 
        `@dolist lattr(${args[1]}/ufun.priv*) = ` + 
          `@function/privileged [after(##,UFUN.PRIV)] = ${args[1]}/##;\n` + 
        `@dolist lattr(${args[1]}/ufun.pres*) = ` + 
          `@function/preserve [after(##,UFUN.PRES)] = ${args[1]}/##;\n` +
        `@dolist lattr(${args[1]}/ufun.pres.priv*) = ` + 
          `@function/preserve/privileged [after(##,UFUN.PRES.PRIV)] = ${args[1]}/##;\n` + 
        `@dolist lattr(${args[1]}/ufun.priv.pres*) = ` + 
          `@function/preserve/privileged [after(##,UFUN.PRIV.PRES)] = ${args[1]}/##;\n` +
        `@trigger ${args[1]}/startup;\n`
        
        data.txt += ufuns
        // Remove the #tag from the file
        return ''
      })
    })
}