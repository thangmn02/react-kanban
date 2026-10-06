//! Process-only WASAPI capture. No microphone or endpoint-wide loopback.
use std::{mem::{size_of, ManuallyDrop}, sync::{mpsc, Mutex}, time::Duration};
use windows::{core::{implement, Interface, Result, HRESULT, IUnknown}, Win32::{
    Media::Audio::*,
    System::{Com::{CoInitializeEx, CoUninitialize, COINIT_MULTITHREADED, StructuredStorage::*}, Variant::VT_BLOB},
}};

#[implement(IActivateAudioInterfaceCompletionHandler)]
struct Activation {
    send: Mutex<Option<mpsc::SyncSender<Result<IAudioClient>>>>,
    _parameters: std::sync::Arc<AUDIOCLIENT_ACTIVATION_PARAMS>,
}
impl IActivateAudioInterfaceCompletionHandler_Impl for Activation_Impl {
    fn ActivateCompleted(&self, operation: windows::core::Ref<IActivateAudioInterfaceAsyncOperation>) -> Result<()> {
        let result = (|| unsafe {
            let mut status = HRESULT(0);
            let mut object: Option<IUnknown> = None;
            operation.ok()?.GetActivateResult(&mut status, &mut object)?;
            status.ok()?;
            object.ok_or_else(windows::core::Error::empty)?.cast()
        })();
        if let Some(send) = self.send.lock().unwrap().take() { let _ = send.send(result); }
        Ok(())
    }
}

pub struct ComApartment;
impl ComApartment {
    pub fn new() -> Result<Self> {
        unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok()?; }
        Ok(Self)
    }
}
impl Drop for ComApartment { fn drop(&mut self) { unsafe { CoUninitialize(); } } }

pub const SAMPLE_RATE: u32 = 44100;
pub struct ProcessCapture { capture: IAudioCaptureClient, client: IAudioClient }
impl ProcessCapture {
    pub fn new(process_id: u32) -> Result<Self> {
        let parameters = std::sync::Arc::new(AUDIOCLIENT_ACTIVATION_PARAMS {
            ActivationType: AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
            Anonymous: AUDIOCLIENT_ACTIVATION_PARAMS_0 { ProcessLoopbackParams: AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS {
                TargetProcessId: process_id, ProcessLoopbackMode: PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE,
            } },
        });
        // The activation blob borrows callback-owned parameters. PROPVARIANT's
        // Windows wrapper normally frees VT_BLOB memory on drop.
        let variant = ManuallyDrop::new(PROPVARIANT {
            Anonymous: PROPVARIANT_0 { Anonymous: ManuallyDrop::new(PROPVARIANT_0_0 {
                vt: VT_BLOB,
                Anonymous: PROPVARIANT_0_0_0 { blob: windows::Win32::System::Com::BLOB {
                    cbSize: size_of::<AUDIOCLIENT_ACTIVATION_PARAMS>() as u32,
                    pBlobData: std::sync::Arc::as_ptr(&parameters) as *mut u8,
                } }, ..Default::default()
            }) },
        });
        let (send, receive) = mpsc::sync_channel(1);
        // The callback retains the blob even if activation finishes after the
        // caller's timeout. It contains no borrowed pointers.
        let callback: IActivateAudioInterfaceCompletionHandler = Activation { send:Mutex::new(Some(send)), _parameters:parameters }.into();
        let operation = unsafe { ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
            &IAudioClient::IID, Some(&*variant), &callback)? };
        let client = receive.recv_timeout(Duration::from_secs(5))
            .map_err(|_| windows::core::Error::from_hresult(HRESULT(0x800705b4u32 as i32)))??;
        drop(operation);
        let format = WAVEFORMATEX { wFormatTag: 3, nChannels: 2, nSamplesPerSec: SAMPLE_RATE,
            nAvgBytesPerSec: SAMPLE_RATE * 8, nBlockAlign: 8, wBitsPerSample: 32, cbSize: 0 };
        unsafe {
            client.Initialize(AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM,
                200_000, 0, &format, None)?;
            let capture = client.GetService()?;
            client.Start()?;
            Ok(Self { client, capture })
        }
    }

    pub fn packet(&self) -> Result<Option<Vec<f32>>> {
        unsafe {
            if self.capture.GetNextPacketSize()? == 0 { return Ok(None); }
            let mut data = std::ptr::null_mut();
            let mut frames = 0;
            let mut flags = 0;
            self.capture.GetBuffer(&mut data, &mut frames, &mut flags, None, None)?;
            let count = frames as usize * 2;
            let result = if count > SAMPLE_RATE as usize * 2 {
                Err(windows::core::Error::from_hresult(HRESULT(0x8007000du32 as i32)))
            } else if flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0 || data.is_null() {
                Ok(vec![0.; count])
            } else {
                Ok(std::slice::from_raw_parts(data as *const f32, count).iter()
                    .map(|sample| if sample.is_finite() { sample.clamp(-1., 1.) } else { 0. }).collect())
            };
            let released = self.capture.ReleaseBuffer(frames);
            released?;
            result.map(Some)
        }
    }
}
impl Drop for ProcessCapture { fn drop(&mut self) { unsafe { let _ = self.client.Stop(); } } }
