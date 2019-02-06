module.exports = app => {

   /**
   * jobs related to compressing down the text file into a quotable format. 
   */
  app.queue('compress')

    // Remove any comments and left over #include tags from the text.
    // Super long regex find for comments: https://bit.ly/2AEtQmS
    .addJob('comments', data => {
      data.log('Removing Comments')
      data.txt = data.txt.replace(/^\/\*[\s\S]*?\*\/|([^\:]|^)\/\/.*/igm, '')
    })

    .addJob('handle-defines', data => {
      for (const [pattern, value] of data.defs) {
        data.txt = data.txt.replace(new RegExp(`${pattern}`, 'g'), (...args) => {
          let dargs = args
          return value.replace(/\$([0-9])/g, (...args) => dargs[parseInt(args[1])])
            .replace(/^\/\*[\s\S]*?\*\/|([^\:]|^)\/\/.*/igm, '')
        })
      }
      
    })


    .addJob('compress', data => {
      let acc = ''
      let lines = []
      data.txt.split('\n').filter(Boolean).forEach(line => {
        if(line.match(/^[&@#-]/)){
          // New command, reset accumulator and push to lines
          lines.push(acc)
          acc = line
        } else  {
          // else add the line onto the accumulator
          acc += ' ' + line
        }
      })

      // Push the final accumulator onto lines
      lines.push(acc)

      // Build an or seperated string for the defines regex.
      const defs = Array.from(data.defs.keys()).join('|')

      lines = lines.map(line => {
          return line.replace(/\s\s+/g, ' ') // Remove extra spaces
          .replace(/^-$/,' ') // replace dashes.
          .replace(/\]\s+\[/, '][') // Remove spaces between brackets
          .replace(/\s+?%([rst])\s+?/gi, '%$1') // Remove spaces around %subs
      })

      // Return txt with any left over #tags removed.
      data.txt = lines.join('\n').replace(/^#.*\n/gim, '')

    })
}
