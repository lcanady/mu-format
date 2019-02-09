module.exports = app => {

   /**
   * jobs related to compressing down the text file into a quotable format. 
   */
  app.queue('compress')
    .addJob('start', data => data.log('Compressing Index'))

    .addJob('compress', data => {
      let acc = ''
      let lines = []
      
      // compress Code
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

      lines = lines.map(line => {
          return line.replace(/\s\s+/g, ' ') // Remove extra spaces
          .replace(/^-/,'') // replace dashes.
          .replace(/\]\s+\[/, '][') // Remove spaces between brackets
          .replace(/\s+?%([rst])\s+?/gi, '%$1') // Remove spaces around %subs
          
      })

      // Return txt with any left over #tags removed.
      data.txt = lines.join('\n').replace(/^#.*\n/gim, '')

    })
}
