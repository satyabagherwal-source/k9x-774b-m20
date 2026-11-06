use std::io;

pub struct TelemetryConfig {
  pub buffer_size: usize,
}

impl TelemetryConfig {
  pub fn new(size: usize) -> Self {
    TelemetryConfig { buffer_size: size }
  }
}

pub fn run_telemetry(cfg: TelemetryConfig) -> Result<(), io::Error> {
  println!("Telemetry running with buffer: {}", cfg.buffer_size);
  Ok(())
}
