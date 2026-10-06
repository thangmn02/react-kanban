//! Resolve only the browser owning the already-accepted Companion connection.
use std::{mem::size_of, collections::HashMap};
use windows::{core::Result, Win32::{Foundation::{CloseHandle, HANDLE, WAIT_TIMEOUT},
    NetworkManagement::IpHelper::{GetExtendedTcpTable, MIB_TCPROW_OWNER_PID, TCP_TABLE_OWNER_PID_ALL},
    Networking::WinSock::AF_INET,
    System::{Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS},
        Threading::{OpenProcess, WaitForSingleObject, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE}}}};

struct Handle(HANDLE);
impl Drop for Handle { fn drop(&mut self) { unsafe { let _ = CloseHandle(self.0); } } }
pub struct BrowserProcess { pub id: u32, handle: Handle }
impl BrowserProcess {
    pub fn alive(&self) -> bool { unsafe { WaitForSingleObject(self.handle.0, 0) == WAIT_TIMEOUT } }
}
fn browser_name(name: &str) -> bool {
    matches!(name.to_ascii_lowercase().as_str(), "brave.exe" | "chrome.exe" | "msedge.exe")
}
fn processes() -> Result<HashMap<u32, (u32, String)>> {
    let snapshot = Handle(unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)? });
    let mut item = PROCESSENTRY32W { dwSize: size_of::<PROCESSENTRY32W>() as _, ..Default::default() };
    let mut result = HashMap::new();
    unsafe {
        Process32FirstW(snapshot.0, &mut item)?;
        loop {
            let end = item.szExeFile.iter().position(|v| *v == 0).unwrap_or(item.szExeFile.len());
            result.insert(item.th32ProcessID, (item.th32ParentProcessID, String::from_utf16_lossy(&item.szExeFile[..end])));
            if Process32NextW(snapshot.0, &mut item).is_err() { break; }
        }
    }
    Ok(result)
}
fn root_for(owner: u32, tree: &HashMap<u32, (u32, String)>) -> Option<u32> {
    let mut root = owner;
    if !browser_name(&tree.get(&root)?.1) { return None; }
    // Bound parent traversal and stop at launchers outside this browser.
    for _ in 0..64 {
        let (parent, name) = tree.get(&root)?;
        if *parent == root { return None; }
        if tree.get(parent).is_none_or(|(_, parent_name)| !parent_name.eq_ignore_ascii_case(name)) { return Some(root); }
        root = *parent;
    }
    None
}
pub fn from_companion_port(port: u16) -> std::result::Result<BrowserProcess, String> {
    let mut bytes = 0;
    unsafe { GetExtendedTcpTable(None, &mut bytes, false, AF_INET.0 as _, TCP_TABLE_OWNER_PID_ALL, 0); }
    if bytes < 4 || bytes > 16 * 1024 * 1024 { return Err("Could not identify the music browser".into()); }
    // Windows writes aligned TCP rows into this bounded, native-owned buffer.
    let mut table = vec![0u64; (bytes as usize).div_ceil(8)];
    let status = unsafe { GetExtendedTcpTable(Some(table.as_mut_ptr() as _), &mut bytes, false, AF_INET.0 as _, TCP_TABLE_OWNER_PID_ALL, 0) };
    if status != 0 { return Err("The music browser connection changed".into()); }
    let count = unsafe { *(table.as_ptr() as *const u32) } as usize;
    if count > (bytes as usize - 4) / size_of::<MIB_TCPROW_OWNER_PID>() { return Err("Invalid browser connection table".into()); }
    let rows = unsafe { std::slice::from_raw_parts((table.as_ptr() as *const u8).add(4) as *const MIB_TCPROW_OWNER_PID, count) };
    let loopback = u32::from_ne_bytes([127,0,0,1]);
    let owner = rows.iter().find(|row| row.dwLocalAddr == loopback && row.dwRemoteAddr == loopback
        && u16::from_be(row.dwLocalPort as u16) == port && u16::from_be(row.dwRemotePort as u16) == 47635)
        .map(|row| row.dwOwningPid).ok_or("The music browser disconnected")?;
    let root = root_for(owner, &processes().map_err(|_| "Could not inspect the music browser")?)
        .ok_or("Automatic beats require Brave, Chrome or Edge")?;
    let handle = Handle(unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE, false, root) }
        .map_err(|_| "Could not access the music browser")?);
    let process = BrowserProcess { id: root, handle };
    if !process.alive() { return Err("The music browser closed".into()); }
    Ok(process)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn follows_only_the_connection_owners_browser_tree() {
        let tree = [(1,(99,"brave.exe".into())), (2,(1,"brave.exe".into())),
            (3,(99,"chrome.exe".into())), (99,(0,"explorer.exe".into()))].into();
        assert_eq!(root_for(2,&tree),Some(1));
        assert_eq!(root_for(3,&tree),Some(3));
        assert_eq!(root_for(99,&tree),None);
        assert_eq!(root_for(0,&tree),None);
        assert!(!browser_name("kora.exe"));
        assert!(!browser_name("brave.exe.bad"));
    }
}
