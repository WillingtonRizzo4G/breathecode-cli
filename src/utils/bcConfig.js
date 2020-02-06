const path = require('path');
const fs = require('fs');
let shell = require('shelljs');
let Console = require('./console');
const frontMatter = require('front-matter');
let _defaults = require('./config/compiler/_defaults.js');
/* exercise folder name standard */
const validateExerciseDirectoryName = (str) => {
    const regex = /^\d{2,2}(?:\.\d{1,2}?)?-[a-zA-z](?:-|_?[a-zA-z]*)*$/;
    return regex.test(str);
};

const merge = (target, ...sources) =>
  Object.assign(target, ...sources.map(x =>
    Object.entries(x)
      .filter(([key, value]) => typeof value !== 'undefined')
      .reduce((obj, [key, value]) => (obj[key] = value, obj), {})
  ));

module.exports = (filePath, { grading, editor, language, disable_grading }) => {

    const confPath = (fs.existsSync(filePath+'bc.json')) ? './bc.json' : (fs.existsSync(filePath+'./.bc.json')) ? './.bc.json' : (fs.existsSync(filePath+'.breathecode/.bc.json')) ? '.breathecode/.bc.json' : '.breathecode/bc.json';

    let config = { language };
    if (fs.existsSync(confPath)){
      const bcContent = fs.readFileSync(confPath);
      const jsonConfig = JSON.parse(bcContent);
      if(!jsonConfig) throw Error(`Invalid ${confPath} syntax: Unable to parse.`);
      config = merge(jsonConfig,{ language, disable_grading });
      Console.debug("This is your configuration file: ",config);
      if(typeof config.language == 'undefined' && typeof config.compiler == 'undefined'){
        Console.error("The language has to be specified in the bc.json or as the -l=[language] flag");
        throw new Error("The language has to be specified in the bc.json or as the -l=[language] flag");
      }
    }
    else{
      if(typeof config.language == 'undefined' && typeof config.compiler == 'undefined'){
        Console.error("The language has to be specified in the bc.json or as the -l=[language] flag");
        throw new Error("The language has to be specified in the bc.json or as the -l=[language] flag");
      }

      if (!fs.existsSync('./.breathecode')) fs.mkdirSync('./.breathecode');
    }

    let defaults = _defaults[config.language || config.compiler];
    if(typeof defaults == 'undefined'){
      Console.error(`Invalid language or compiler: ${config.language || config.compiler}`);
      throw new Error(`Invalid language or compiler: ${config.language || config.compiler}`);
    }

    // Assign default editor mode if not set already
    if(!config.editor){
      if (shell.which('gp')) config.editor = "gitpod";
      else config.editor = "standalone";
    }

    // if ignoreRegex is saved into a json, it saves as an object abd breaks the cli
    if(config.ignoreRegex && config.ignoreRegex.constructor !== RegExp) delete config.ignoreRegex;

    config = merge(defaults || {}, config, { grading, editor } );
    config.exercisesPath = config.grading === "isolated" ? filePath+'exercises' : filePath+'.breathecode/exercises';

    Console.debug("This is your configuration: ", defaults);
    if (config.grading === 'isolated' && !fs.existsSync(config.exercisesPath))  throw Error(`You are running with ${config.grading} grading, so make sure you have an exercises folder on ${config.exercisesPath}`);

    return {
        getConfig: () => config,
        getTestReport: (slug=null) => {
          if(!slug) throw Error("You have to specify the exercise slug to get the results from");

          const _path = `./.breathecode/reports/${slug}.json`;
          if (!fs.existsSync(_path)) return {};

          const content = fs.readFileSync(_path);
          const data = JSON.parse(content);
          return data;
        },
        getReadme: (slug=null) => {
            if(slug){
                const exercise = config.exercises.find(ex => ex.slug == slug);
                if (!exercise) throw Error('Exercise not found');
                const basePath = exercise.path;
                if (!fs.existsSync(basePath+'/README.md')) throw Error('Readme file not found for exercise: '+basePath+'/README.md');

                const content = fs.readFileSync(basePath+'/README.md',"utf8");
                const attr = frontMatter(content);
                return attr;
            }
            else{
                if (!fs.existsSync('./README.md')) throw Error('Readme file not found');
                return frontMatter(fs.readFileSync('./README.md',"utf8"));
            }
        },
        getFile: (slug, name) => {
            const exercise = config.exercises.find(ex => ex.slug == slug);
            if (!exercise) throw Error(`Exercise ${slug} not found`);
            const basePath = exercise.path;
            if (!fs.existsSync(basePath+'/'+name)) throw Error('File not found: '+basePath+'/'+name);
            else if(fs.lstatSync(basePath+'/'+name).isDirectory()) return 'Error: This is not a file to be read, but a directory: '+basePath+'/'+name;
            return fs.readFileSync(basePath+'/'+name);
        },
        getAsset: (name) => {
            if (!fs.existsSync('./_assets/'+name)) throw Error('File not foundin: ./_assets/'+name);
            return fs.readFileSync('./_assets/'+name);
        },
        saveFile: (slug, name, content) => {
            const exercise = config.exercises.find(ex => ex.slug == slug);
            if (!exercise) throw Error('Exercise '+slug+' not found');
            const basePath = exercise.path;
            if (!fs.existsSync(basePath+'/'+name)) throw Error('File not found: '+basePath+'/'+name);
            return fs.writeFileSync(basePath+'/'+name, content, 'utf8');
        },
        getExerciseDetails: (slug) => {

            const exercise = config.exercises.find(ex => ex.slug == slug);
            if (!exercise) throw Error('Exercise not found: '+slug);
            const basePath = exercise.path;

            const isDirectory = source => fs.lstatSync(source).isDirectory();
            const getFiles = source => fs.readdirSync(source)
                                        .map(file => ({ path: source+'/'+file, name: file}))
                                            // TODO: we could implement some way for teachers to hide files from the developer, like putting on the name index.hidden.js
                                            .filter(file =>
                                                // ignore tests files and files with ".hide" on their name
                                                (file.name.toLocaleLowerCase().indexOf('test.') == -1 && file.name.toLocaleLowerCase().indexOf('tests.') == -1 && file.name.toLocaleLowerCase().indexOf('.hide.') == -1 &&
                                                //ignore java copiled files
                                                (file.name.toLocaleLowerCase().indexOf('.class') == -1) &&
                                                //readmes and directories
                                                file.name != 'README.md' && !isDirectory(file.path) && file.name.indexOf('_') != 0) &&
                                                //ignore javascript files when using vanillajs compiler
                                                (!config.ignoreRegex || !config.ignoreRegex.exec(file.name))
                                                ).sort((f1, f2) => {
                                                    const score = { //sorting priority
                                                      "index.html": 1,
                                                      "styles.css": 2,
                                                      "styles.scss": 2,
                                                      "style.css": 2,
                                                      "style.scss": 2,
                                                      "index.css": 2,
                                                      "index.scss": 2,
                                                      "index.js": 3,
                                                    };
                                                    return score[f1.name] < score[f2.name] ? -1 : 1;
                                                });
            if(config.grading === 'incremental') return getFiles('./');
            else return getFiles(basePath);
        },
        getAllFiles: (slug) => {
            const exercise = config.exercises.find(ex => ex.slug == slug);
            if (!exercise) throw Error('Exercise not found: '+slug);
            const basePath = exercise.path;
            const isDirectory = source => fs.lstatSync(source).isDirectory();
            const getFiles = source => fs.readdirSync(source)
                                        .map(file => ({ path: source+'/'+file, name: file}));
                                            // TODO: we could implement some way for teachers to hide files from the developer, like putting on the name index.hidden.js
                                            //.filter(file => (file.name.indexOf('tests.') > -1 || file.name.indexOf('test.') > -1 )); // hide directories, readmes and tests
            return getFiles(basePath);
        },
        buildIndex: function(){
            const isDirectory = source => fs.lstatSync(source).isDirectory();
            const getDirectories = source => fs.readdirSync(source).map(name => path.join(source, name)).filter(isDirectory);
            if (!fs.existsSync('./.breathecode')) fs.mkdirSync('./.breathecode');
            if (config.outputPath && !fs.existsSync(config.outputPath)) fs.mkdirSync(config.outputPath);

            // TODO we could use npm library front-mater to read the title of the exercises from the README.md
            config.exercises = getDirectories(config.exercisesPath).map(ex => ({ slug: ex.substring(ex.indexOf('exercises/')+10), title: ex.substring(ex.indexOf('exercises/')+10), path: ex}));
            config.exercises.forEach(d => {
                if(!validateExerciseDirectoryName(d.slug)){
                    Console.error('Exercise directory "'+d.slug+'" has an invalid name, it has to start with two digits followed by words separated by underscors or hyphen (no white spaces). e.g: 01.12-hello-world');
                    Console.help('Verify that the folder "'+d.slug+'" starts with a number and it does not contain white spaces or weird characters.');
                    throw new Error('Error building the exercise index');
                }
            });

            this.save();
        },
        save: () => {
          fs.writeFileSync(confPath, JSON.stringify(config, null, 4))
        }
    };
};
