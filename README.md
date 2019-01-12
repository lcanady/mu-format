# mu-format
A Program that turns pretty formatted MUSHCode into something you can quote to your client. It reads and combines different pieces from different files into a single document that you can use to install MUSHCode on your game.

## Installation
The formatter isn't on NPM yet (I want to test it in the wild first), but you can download it from github using the npm tool.
```
npm i -s lcanady/mu-format
```
## Usage
There are just a few steps in setting up the formatter.
```JavaScript
// Create your app
const Formatter = require('mu-formatter');
const app = new Formatter();

// Set your shortcut header tags.  These can be things like 'author'
// 'codebase', etc. They are accessed by typing #<header> <entry> into your
// pre-formatted file. They'll show up at the top after formatting if headers
// are turned on.
app.setHeaders('author codebase url email');

// Add any plugin files.
app.plugins(['./extras/plugins/plugin1','./another/place/plugin2')];

// Setup event listeners
app.on('log', log => console.log(log));
app.on('error', (error,message) => app.log(message||error.message));
app.on('done', results => console.log(results.document));

// Now run the formatter! If you run a file from the directory level, or from
// a github repo, it will look for a file called `installer.mu`.
app.format('./code/codefile.mu'); // or
app.format('./code/');            // or
app.format('github:user/repo');    
```

## The Queue and Jobs.
At it's heart, Mu-Format is a middleware driven system that runs lists, or queues of functions, or jobs. The main queue most will be working with is the render or pre-render queues. Honestly, you can create whatever queues you want to assist in your program, those are just the main attached to the formatter generally! Each job is passed a `data` object, containing information about the document currently, as well as a few helper functions. More info on the data object coming in the api!
```JavaScript
// First, create a queue.  When you call the queue command, it will either create
// the queue if it doesn't exist - or load an existing queue object. We can link our
// methods through chaining. The job function is passed a single parameter, data,
// which holds all of the job information available. 
app.queue('render')
  .addJob('someJob', (data) => {
    // actions on the data object. Normally you'll be working on data.txt where the
    // document contents are stored - but there are other things the data object can
    // do. API Coming soon!!
    console.log(data.txt);
  });

  // to run a queue. Data can be anything.
  app.queue('name').run(data);
  // to run a single job from a queue:
  app.queue('name').job('jobName')(data)
```

## Creating plugins
Creating a plugin for the system is pretty straight forward.  Make a module that exports a function.
```JavaScript
// ./some/folder/plugin.js

module.exports = (app) => {
  app.queue('render')
    .addJob('messages' (data) => {
      // replace a tag in the file using  regular expression to match.
      data.txt = data.txt.replace(/#(msg|wrn|err)\s+?(.*)\n/ig, (...args) => {
        
        let lvl = '';
        switch(true){
          // remember, arg[0] is the match itself!
          case args[1].toLowerCase() === 'wrn':
            lvl = '%cyWarning';
          case args[1].toLowerCase() === 'err':
            lvl = '%crError';
          default:
            lvl = '%chMessage';
        }
        // return our formatted string.
        return `think %ch${lvl}:%cn ${args[2]}`;
      });      
    });
}

// index.js

// after your app is declared.
app.plugins(['./plugins/plugin.js'])

// Or you can declare plugins at runtime.
app.format('github:user/repo',{plugins:['./plugins/plugin.js']});

// You can even just require the file:
require('./plugins/plugin.js')(app);

// Then in our raw document we use the tag:
// #msg This is a message that will be rendered to the client.
```
## API Coming Soon!