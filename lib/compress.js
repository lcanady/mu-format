module.exports = app => {

   /**
   * jobs related to compressing down the text file into a quotable format. 
   */
  app.queue('compress')

    // Remove any comments and left over #include tags from the text.
    // Super long regex find for comments: https://bit.ly/2AEtQmS
    .addJob('comments', data => {
      data.log('Removing Comments '.padEnd(68,'-'));
      const regex = new RegExp(
        '\/\\*[\\s\\S]*?\\*\\/|([^\\\\:]|^)\\/\\/.*|<!--[\\s\\S]*?-->$','gm'
      );
      data.txt = data.txt.replace(regex, '');
      data.txt = data.txt.replace(/#\w+.*/gi, '');
    })

    .addJob('compress', data => {
      let input = data.txt;
      let contents = [];
      data.log('Compressing document '.padEnd(68,'-'))
      input = input.split(/\n-\n/).filter(Boolean).map(line =>{
        line = line.replace(/\n/g, ' ') // remove extra newlines
          .replace(/^#.*/, '') // remove unevaluated meta-tags.
          .replace(/\s\s+/g, ' ') // remove extra spaces
          .replace(/\]\s+\[/, '][') // remove spaces between brackets.
          .replace(/\s?%(r|t)\s?/gi, '%$1') // remove spaces around %subs
          .trim();
        if(line !== '') contents.push(line)
      });
      
      data.txt = contents.join('\n');
    });
}