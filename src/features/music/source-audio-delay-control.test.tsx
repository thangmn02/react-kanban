import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import SourceAudioDelayControl from './source-audio-delay-control';
import type {BrowserMusicController} from './useBrowserMusic';

afterEach(cleanup);
function controller(patch:Record<string,unknown>={},session:Record<string,unknown>={}){
 return {selected:{id:'source',title:'Song',source:'www.youtube.com',paused:true,...session},refresh:vi.fn(),
  sourceAudioDelay:{owner:'source:1',enabled:false,status:'off',delayMs:170,supported:true,busy:false,error:'',transitioning:false,setEnabled:vi.fn(),...patch}} as unknown as BrowserMusicController;
}
it('defaults Off, explains the consequence and needs explicit consent while paused',()=>{
 const music=controller();render(<SourceAudioDelayControl music={music}/>);
 expect(screen.getByRole('status',{name:'Enhanced Beat Sync status'})).toHaveTextContent('Off');
 expect(screen.getByText('Audio may play slightly later to match Beat Grid.')).toBeVisible();
 const on=screen.getByRole('button',{name:'Turn on Enhanced Beat Sync'});expect(on).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(on);expect(music.sourceAudioDelay!.setEnabled).toHaveBeenCalledWith(true);
});
it('cannot turn on while playing or for an unsupported source',()=>{
 render(<SourceAudioDelayControl music={controller({},{paused:false})}/>);fireEvent.click(screen.getByRole('checkbox'));
 expect(screen.getByRole('button',{name:'Turn on Enhanced Beat Sync'})).toBeDisabled();cleanup();
 render(<SourceAudioDelayControl music={controller({supported:false})}/>);
 expect(screen.getByText(/Playback controls still work/)).toBeVisible();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
it('offers OFF during preparation and playback without another consent',()=>{
 for(const patch of [{status:'preparing',busy:true},{enabled:true,status:'active'}]){
  const music=controller(patch,{paused:false});render(<SourceAudioDelayControl music={music}/>);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Turn off'}));
  expect(music.sourceAudioDelay!.setEnabled).toHaveBeenCalledWith(false);cleanup();
 }
});
it('keeps a failed OFF visible with a retry',()=>{
 const music=controller({enabled:true,status:'error',error:'Turning off is not confirmed.'});render(<SourceAudioDelayControl music={music}/>);
 expect(screen.getByRole('status',{name:'Enhanced Beat Sync status'})).toHaveTextContent('Error');
 expect(screen.getByRole('alert')).toHaveTextContent('not confirmed');expect(screen.getByRole('button',{name:'Turn off'})).toBeEnabled();
});
it('requires fresh consent when the source changes',()=>{
 const view=render(<SourceAudioDelayControl music={controller()}/>);fireEvent.click(screen.getByRole('checkbox'));
 view.rerender(<SourceAudioDelayControl music={controller({owner:'another-source:2'})}/>);
 expect(screen.getByRole('checkbox')).not.toBeChecked();
});
it('keeps the previous source turning off visible after discovery loses the selection',()=>{
 const music=controller({enabled:true,status:'turning-off',transitioning:true});music.selected=undefined;
 render(<SourceAudioDelayControl music={music}/>);
 expect(screen.getByRole('status',{name:'Enhanced Beat Sync status'})).toHaveTextContent('Turning off — restoring');
 expect(screen.getByRole('button',{name:'Turning off…'})).toBeDisabled();
});
