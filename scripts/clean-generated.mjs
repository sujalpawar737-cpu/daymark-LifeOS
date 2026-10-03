import {readdir,unlink} from 'node:fs/promises';
import {join} from 'node:path';
// Remove only prior Vite hashed JavaScript artifacts. The PWA precache must not include old builds.
for(const directory of ['dist/assets','android/app/src/main/assets/public/assets']){
  let names=[];try{names=await readdir(directory)}catch{continue}
  for(const name of names)if(/^index-[A-Za-z0-9_-]+\.js$/.test(name))await unlink(join(directory,name));
}
