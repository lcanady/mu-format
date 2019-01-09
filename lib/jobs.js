const Formatter = require('./Formatter')

const app = new Formatter();
    
app.queue('open')
  
  .addJob('open', data => {

    const include = async fileData => {
      
      lines = fileData.split('\n|\nr|\r').filter(Boolean).forEach(async line =>{
        line = line.replace(/^#include\s+(.*)$/, ...args => {
          
        })
      })
      
      app.queue('open').jobs.get('open-file')(data);

    }

    include(await app.queue('open').jobs.get('open-file')(data));
  });
  
