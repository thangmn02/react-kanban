//! Explicit private debug experiment; public builds retain the Windows route.
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub fn allowed(debug: bool, flag: Option<&str>, identifier: &str) -> bool {
    debug && flag == Some("1") && identifier == "app.kanthangboard.ownerpreview"
}

pub fn source_delay_allowed(flag: Option<&str>, identifier: &str) -> bool {
    flag == Some("1") && matches!(identifier, "app.kanthangboard.focus" | "app.kanthangboard.qualification" | "app.kanthangboard.ownerpreview")
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Configuration {
    enabled: bool,
    capture_id: String,
    generation: u64,
    intentional_delay: bool,
    output_heard: bool,
    authorized_audio: bool,
    preview: bool,
    compensation_ms: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    detector_variant: Option<String>,
}

pub fn configuration(value: Value) -> Result<Value, String> {
    let config: Configuration = serde_json::from_value(value).map_err(|_| "Invalid private delay configuration")?;
    if config.capture_id.is_empty() || config.capture_id.len() > 160
        || !config.capture_id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-' || b == b':')
        || config.generation > 9_007_199_254_740_991 || config.compensation_ms > 300
        || config.detector_variant.as_deref().is_some_and(|variant| variant != "L0")
        || config.enabled != config.preview
        || (config.enabled && (config.compensation_ms == 0 || !config.intentional_delay || !config.output_heard || !config.authorized_audio))
        || (!config.enabled && config.compensation_ms != 0)
    { return Err("Invalid private delay configuration".into()); }
    serde_json::to_value(config).map_err(|_| "Invalid private delay configuration".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn valid() -> Value { json!({"enabled":true,"captureId":"capture","generation":1,"intentionalDelay":true,"outputHeard":true,"authorizedAudio":true,"preview":true,"compensationMs":250}) }
    #[test]
    fn requires_private_debug_build_and_exact_isolated_identity() {
        assert!(allowed(true,Some("1"),"app.kanthangboard.ownerpreview"));
        assert!(!allowed(false,Some("1"),"app.kanthangboard.ownerpreview"));
        assert!(!allowed(true,None,"app.kanthangboard.ownerpreview"));
        assert!(!allowed(true,Some("1"),"app.kanthangboard.focus"));
    }
    #[test]
    fn admits_optional_release_route_only_with_its_build_gate_and_known_identity() {
        assert!(source_delay_allowed(Some("1"), "app.kanthangboard.focus"));
        assert!(source_delay_allowed(Some("1"), "app.kanthangboard.qualification"));
        assert!(!source_delay_allowed(None, "app.kanthangboard.focus"));
        assert!(!source_delay_allowed(Some("1"), "another.application"));
    }
    #[test]
    fn validates_bounded_consented_l0_configuration_and_explicit_off() {
        assert!(configuration(valid()).is_ok());
        for (field,value) in [("compensationMs",json!(301)),("compensationMs",json!(0)),("generation",json!(-1)),("captureId",json!("../capture")),("authorizedAudio",json!(false)),("outputHeard",json!(false)),("intentionalDelay",json!(false)),("preview",json!(false)),("detectorVariant",json!("H-LIVE")),("arbitraryCommand",json!(true))] {
            let mut config=valid();config[field]=value;assert!(configuration(config).is_err(),"{field}");
        }
        assert!(configuration(json!({"enabled":false,"captureId":"capture","generation":1,"intentionalDelay":false,"outputHeard":false,"authorizedAudio":false,"preview":false,"compensationMs":0})).is_ok());
    }
}
