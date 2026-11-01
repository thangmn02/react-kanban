import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type {BrowserMusicController} from './useBrowserMusic';

vi.mock('../native/runtime',()=>({nativeSourceAudioDelayEnabled:()=>true}));
const {default:RawControl,EnhancedBeatSyncSetting:RawSetting}=await import('./source-audio-delay-control');
const {I18nProvider}=await import('../../i18n');
const SourceAudioDelayControl=(props:{music:BrowserMusicController})=><I18nProvider><RawControl {...props}/></I18nProvider>;
const EnhancedBeatSyncSetting=()=><I18nProvider><RawSetting/></I18nProvider>;
const {readEnhancedBeatSyncPreference}=await import('./use-source-audio-delay');

beforeEach(()=>localStorage.clear());
afterEach(cleanup);
function controller(patch:Record<string,unknown>={}){
 return {selected:{id:'source',title:'Song',source:'music.youtube.com',paused:false},refresh:vi.fn(),
  sourceAudioDelay:{owner:'source',enabled:false,preferred:false,status:'off',delayMs:170,supported:true,busy:false,error:'',setPreferred:vi.fn(),...patch}} as unknown as BrowserMusicController;
}
it('offers a one-tap turn-on in the Music tab while Off, behind the same confirmation',()=>{
 const music=controller();render(<SourceAudioDelayControl music={music}/>);
 expect(screen.getByRole('status',{name:'Enhanced Beat Sync status'})).toHaveTextContent('Off');
 fireEvent.click(screen.getByRole('button',{name:'Turn on'}));expect(screen.getByText(/about 0.17 s later/)).toBeVisible();
 expect(music.sourceAudioDelay!.setPreferred).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Turn on'}));expect(music.sourceAudioDelay!.setPreferred).toHaveBeenCalledWith(true);
});
it('turns off from the Music tab and translates known hints',()=>{
 const music=controller({preferred:true,enabled:true,status:'unavailable',hint:'Not available for this source right now. Music plays normally.'});
 render(<SourceAudioDelayControl music={music}/>);expect(screen.getByText(/Not available for this source/)).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Turn off'}));expect(music.sourceAudioDelay!.setPreferred).toHaveBeenCalledWith(false);
});
it('shows one compact status with a short hint, and no research or delay controls',()=>{
 render(<SourceAudioDelayControl music={controller({preferred:true,enabled:true,status:'preparing',hint:'Click the Kora Music Companion icon on the music tab once so it can take over the sound.'})}/>);
 expect(screen.getByRole('status',{name:'Enhanced Beat Sync status'})).toHaveTextContent('Preparing');
 expect(screen.getByText(/Click the Kora Music Companion icon/)).toBeVisible();
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(screen.queryByText(/170 ms|capture|buffer|candidate/i)).not.toBeInTheDocument();
 cleanup();render(<SourceAudioDelayControl music={controller({preferred:true,enabled:true,status:'on'})}/>);
 expect(screen.getByRole('status',{name:'Enhanced Beat Sync status'})).toHaveTextContent('On');
});
it('shows an error even after the setting is turned off',()=>{
 render(<SourceAudioDelayControl music={controller({status:'error',error:'Turning off is not confirmed.'})}/>);
 expect(screen.getByRole('alert')).toHaveTextContent('not confirmed');
});
it('asks once before turning on, remembers the approval and turns off immediately',()=>{
 render(<EnhancedBeatSyncSetting/>);
 const toggle=screen.getByRole('checkbox',{name:/Line the Beat Grid up/});expect(toggle).not.toBeChecked();
 fireEvent.click(toggle);expect(screen.getByText(/about 0.17 s later/)).toBeVisible();expect(readEnhancedBeatSyncPreference()).toBeUndefined();
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(readEnhancedBeatSyncPreference()).toBeUndefined();
 fireEvent.click(toggle);fireEvent.click(screen.getByRole('button',{name:'Turn on'}));
 expect(readEnhancedBeatSyncPreference()).toMatchObject({approvedDelayMs:170});expect(screen.getByRole('checkbox',{name:/Line the Beat Grid up/})).toBeChecked();
 fireEvent.click(screen.getByRole('checkbox',{name:/Line the Beat Grid up/}));expect(readEnhancedBeatSyncPreference()).toBeUndefined();
});
