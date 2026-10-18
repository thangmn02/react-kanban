// Own one native streaming media clock; model/renderer changes never call these.
export class FullSongAudio {
 readonly element=new Audio();
 clear(){this.element.pause();this.element.removeAttribute('src');this.element.load();}
 load(url:string){this.element.src=url;this.element.preload='auto';this.element.playbackRate=1;}
 seek(time:number){this.element.currentTime=time;}
}
