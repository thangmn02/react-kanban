import type {IncomingMessage,ServerResponse} from 'node:http';
export function createFullSongStore(root:string,options?:{allowedOrigins?:string[]}):Promise<{
 handle(request:IncomingMessage,response:ServerResponse,url:URL):Promise<boolean>;
 clip(id:string):Promise<Record<string,unknown>|null>;
 register(path:string,filename:string,slot:string):Promise<string>;
 status(id:string):Promise<Record<string,unknown>>;
 cancel(id:string):Promise<void>;stop():Promise<void>;root:string;
}>;
