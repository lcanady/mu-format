module.exports = app => {

   /**
   * jobs related to compressing down the text file into a quotable format. 
   */
  app.queue('compress')

    // Remove any comments and left over #include tags from the text.
    // Super long regex find for comments: https://bit.ly/2AEtQmS
    .addJob('comments', data => {
      data.log('Removing Comments ')
      data.txt = data.txt.replace(/^\/\*[\s\S]*?\*\/|([^\:]|^)\/\/.*/igm, '')
      data.txt = data.txt.replace(/^#.*\n/gim, '')
    })

    .addJob('compress', data => {
    
      let acc = ''
      let lines = [];
      data.log('Compressing document')
      
      const rawArray = data.txt.trim().split(/\s*?\n/).filter(Boolean)
      
      const formatArray = rawArray.forEach((line, idx) => {
        // If the line begins with a & or @ it's a new commnand.
        if(line.match(/^[@|&]/)){
          // Push the current contents of the accumulator to the lines array
          lines.push(acc)
          acc = line
        } else {
          // Add the current line to the accumulator
          acc += ' ' + line
        }
      })

      // Push the last line onto the lines array
      lines.push(acc)

      lines = lines.join('\n')
        .replace(/\s\s+/g, ' ') // remove extra spaces
        .replace(/\]\s+\[/, '][') // remove spaces between brackets.
        .replace(/\s?%(r|t)\s?/gi, '%$1') // remove spaces around %subs
      
      data.txt = lines
    })
}
