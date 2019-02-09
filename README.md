# Mu-Format
A Program that turns pretty formatted MUSHCode into something you can quote to your client, mixed with a few extras to speed up your coding flow.

## Installation
```
npm i mu-format
```
## Usage
There are just a few steps in setting up the formatter.
```js
// Create your app
const Formatter = require('mu-formatter');

const app = new Formatter({
  plugins: [
    './extras/plugins/plugin1',
    './another/place/plugin2'
  ]
});

// Setup some event listeners
app.on('log', log => console.log(log));
app.on('error', error => app.logger(error.stack));
app.on('done', results => console.log(results[0].contents));

// Now run the formatter! If you run a file from the directory
// level, or from a github repo, it will look for a file called
// `installer.mu`.
app.format('./code/codefile.mu'); // or
app.format('./code/');            // or
app.format('github:user/repo');    
```

## The Queue and Jobs
At it's heart, Mu-Format is a middleware driven program that runs lists, or queues of functions, or jobs. The majority of the work happens in in the render (or pre-render) and compress (or pre-compress) queues. 

#### The Data Object
Each job is passed a `data` object, containing information about the document currently, as well as a few helper functions to trigger formatter events.

```js
//Some functionality removed for simplification.
const data = {
  path: './code/installer.mu',
  baseDir: './code/',
  
  // The working text of the format file.  
  // All of the #includes are combined into this 
  // attribute, and modify it through out the format
  // process.
  txt: '...',
  
  // A copy of the composited document before rendering 
  // and compressing.
  raw: '...',

  // vars is a unified place to save working data.
  vars: {
    headers: [
      {
        name: 'Foo',
        value: 'bar'
      },
      {
        name: 'Something',
        value: 'important'
      }
    ]
  },

  // The options passed to mu-format at instantiation
  options: {
    plugins: [
      'plugin1',
      '/path/to/plugin2'
    ]
  }
}

```

#### Helper Functions
**data.emit('Event',[data])** Trigger a custom event on the formatter object.

**data.log(message)** Trigger a 'log' event on the formatter object, and also save the message in the result object log. 

**data.error(error)** Trigger an 'error' event on theformatter object.  Error must be an error object.

### Defining Queues and Jobs
```js

module.exports = app => {
  // First, create a queue.  When you call the queue command,
  // it will either create the queue if it doesn't exist - or
  // load an existing queue object. We can link our methods 
  // through chaining. The job function is passed a single 
  // parameter, data.
  app.queue('render')

    .addJob('someJob', data => {
      // actions on the data object. Normally you'll be working 
      // on data.txt where the document contents are stored
      // - but there are other things the data object can do.
      data.log('Log message!')
    })
}
```
```js
// to run a single job from a queue:
app.queue('name').job('jobName')(data)
```

## Creating plugins
Creating a plugin for the system is pretty straight forward.  Make a module that exports a function.
```js
/* .plugins/plugin.js */

module.exports = app => {
  app.queue('pre-render')
    .addJob('custom-job' data => {
      // Do whatever processing you need to do on the current
      // document (data.txt).        
    })
}

 /* index.js */

// after your app is declared.
app.plugins(['./plugins/plugin.js'])

// Or you can declare plugins at runtime.
app.format('github:user/repo',{
  plugins:['./plugins/plugin.js']
})

// You can even just require the file:
require('./plugins/plugin.js')(app)
```
## Formatting Rules
The rules for formatting .mu documents is pretty simple! First, You can format your code however you'd like.  I suggest adopting an easy to read style using indentations and spacing to make your code digestable. MU-Format looks for ```[&+@-]``` in the first position of the current line to designate the start of a new command, attribute, or spacer. You can add comments in your code in either ```/* ... */``` block style or ```//``` inline style comments.
A spacer, or dash ```-``` is a purely cosmetic mark for formatting the program output. During the compression phase blank lines are removed. Dashes become newlines making the processed code a little easier to process through.

```
/*
------------------------------------------
--- Commands: +things & +stuff -----------
*/
@@ A comment for someone reading your minified code.
-

&cmd.mycommand me = $+Stuff *:
  @pemit %#=You entered things and %0.

// Another command that does things
&cmd.mycommandtwo me = $+things *=*:
  
  // Sets an attribute on myself!
  &_things me=%0-%1;
  think Things %0 %1! // Wut?

```
When we format this block of code, it turns into:

```
@@ A comment for someone reading your minified code.

&cmd_mycommand me = $+Stuff *: @pemit %#=You entered things and %0.
&cmd_mycommandtwo me = $+things *=*: &_things me=%0-%1; think Things %0 %1!
```
**Simple!**

The real power of Mu-Format comes in it's #meta tag system.  #metas are, when the code is processed, translated into MU friendly output.  They are honestly a good way to save a few keystrokes and even organize your code projects.  Lets take a look at the few that exist right now:

### #include /path/to/file.mu
this #meta allows you to import a file (or entire Github repository) into the current file.  #include accepts three kinds of files right now:
- **Local File** 
You can designate a local file to include, entering the ```./path/to/file.mu``` format.
- **Local Directory** 
If you list a directory, Mu-Format will look for a file called ```installer.mu``` and kick off the #include from there.
- **Github Archive** 
This is the same as installing from a local directory, instead you'll you'll enter ```github:user/repo```. If you start hitting errors while compiling from Github, try adding Github authorization when you create a new Formatter object. 

```js
app = new Formatter({
  gitUser: 'user',
  gitPass: '123Secret!'
})
```

**Example**
```
&cmd.command #123 = $foo *:
  think me Foo %0.

// Include the rest of the library.
#include ./path/to/file2.mu

```
### #esc|#file [file[|string]]
Honestly #esc (or #file) works list like #include, except it escapes each line of text with a MUSH null string ```@@``` so they don't get quoted to the Game.  This is great for things like license files, and other custom comments text.

```
@@ Legal Stuff
@@ Bla bla, yadda
@@
@@ Instructions
@@ ----------------
@@ 1. Things and
@@ 2. Stuff
```

### #header or #footer key=value
Add key/value information to be listed at the very top or bottom of the resulting file.
```#header version=1.0.0``` escapes into: ```@@ version 1.0.0``` at the top of the resulting document.

### #def string|regex
Roll your own edits! I wanted to keep the system as open to modification as I could. ```#def``` #metas are are a way to replace tags with code at processing time. I find them really useful for code snippets that I'm going to use more than once or twice. Remember! a ```@&-+``` at the beginning of a line results in a new command or attribute being defined.

```
#def #check-wiz
  @assert hasflag(%#,Wizard) = {@pemit %#=Permission denied.}
#enddef
```

Then later in your code:

```
&cmd.wizcode #1234=$+cmd foobar:
  #wiz-check
  // Rest of your code ...
```

You can also make a ```#def``` that uses a regular expression string (you don't need to provide the beginning and end of the search ```//```).  Any group matches can represented in your code in the variables ```$0 - $9```  Remember! ```$0``` is the entire match.

```
#def #create\s+(.*)\s*=\s*(.*)
@if [locate(me,$1,*)] = {
  @create $1;
  &$2 me = [locate(me,$1,*)];
},{
  &$2 me = [locate(me,$1,*)];
}
#enddef
```