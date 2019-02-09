module.exports = app => {
  app.queue('header')
    .addJob('header', data => {
      let headers = '';
      if(data.vars.headers.length > 0){
        data.vars.headers.forEach(header =>{
          headers += `@@ ${header.name.padEnd(20)} ${header.value}\n`;
        })
        data.txt = headers + '\n' + data.txt.trim()
      }
    });

  app.queue('footer')
    .addJob('footer', data => {
      let footers = ''
      if(data.vars.headers.length > 0){
        data.vars.footers.forEach(footer => {
          footers += `@@ ${footer.name.padEnd(20)} ${footer.value}\n`;
        })
      }

      footers += `@@ Formatted with Mu-Format v${data.version}\n`;
      footers += '@@ https://github.com/lcanady/mu-format\n'
      data.txt = data.txt.trim() + '\n\n' + footers
    });
}