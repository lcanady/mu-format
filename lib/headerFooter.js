module.exports = app => {
  app.queue('header')
    .addJob('header', data => {
      let headers = '';
      data.log('Adding headers '.padEnd(68,'-'))
      if(data.headers.length > 0 && data.validHeaders.length > 0){
        data.headers.forEach(header =>{
          headers += `@@ ${header.name.padEnd(20)} ${header.value}\n`;
        })
        data.header += headers + '\n';
      }
    });

  app.queue('footer')
    .addJob('footer', data => {
      data.log('Adding footer')
      let footer = '@@ Formatted with Mu-Format\n';
      footer += '@@ https://github.com/lcanady/mu-format\n'
      data.footer += footer;
    });
}