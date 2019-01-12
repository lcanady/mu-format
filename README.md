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

// Now run the formatter! If you run a file from the directory level, or from a github repo, it will
// look for a file called `installer.mu`.
app.format('./code/codefile.mu'); // or
app.format('./code/');            // or
app.format('github:user/repo');    
```
## API Documentation coming soon!
