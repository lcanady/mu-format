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
      data.txt = data.txt.replace(/^#.*\n/gim, '')
    })

    .addJob('compress', data => {
      data.log('Compressing document')
      let acc = ''
      let lines = []
      data.txt.split('\n').filter(Boolean).forEach(line => {
        if(line.match(/^&|^@/)){
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

      lines = lines.filter(Boolean).map(line => {
        line = line.replace(/\s\s+/g, ' ') // Remove extra spaces
          .replace(/\]\s+\[/, '][') // Remove spaces between brackets
          .replace(/\s?%(r|t)\s?/gi, '%$1') // Remove spaces around %subs
        return line
      })

      data.txt = lines.join('\n')

    

      // data.txt = data.txt.replace(/([@|&][^@&]+)\n$/gm, (...args) => {   
      //   return args[1].replace(/\s\s+/g, ' ') // remove extra spaces
      //   .replace(/\]\s+\[/, '][') // remove spaces between brackets.
      //   .replace(/\s?%(r|t)\s?/gi, '%$1') // remove spaces around %subs
      // })
      // data.txt

    })
}
