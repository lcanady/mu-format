const Formatter = require('./lib/Formatter');

const app = new Formatter();

require('./lib/jobs')(app);

app.setHeaders("system author email url file_name");

app.format('./examples/installer.mux')
// app.on('complete', results => console.log(results));
app.on('error', error => console.log(error.stack));
app.on('log', log => {console.log(log)});