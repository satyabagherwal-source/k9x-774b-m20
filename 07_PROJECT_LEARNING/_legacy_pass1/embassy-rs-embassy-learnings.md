# Forensic Learning Record (Deep Inspection): embassy-rs/embassy

> **Canonical Artifact**: `07_PROJECT_LEARNING/embassy-rs-embassy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/embassy-rs/embassy](https://github.com/embassy-rs/embassy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:18:07.247Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `embassy-rs/embassy`
- **Description**: Modern embedded framework, using Rust and async.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9894 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cyw43-firmware/src/bin/write_nvrams.rs`
```
use std::{env, fs, io};

fn strip_after_char(input: &str, delimiter: char) -> &str {
    match input.find(delimiter) {
        Some(index) => &input[..index],
        None => input,
    }
}

fn main() -> io::Result<()> {
    let current_dir = env::current_dir()?;

    println!("current dir: {:?}", &current_dir);

    let files = fs::read_dir(current_dir)?.filter_map(|e| e.ok()).filter(|e| {
        let file_name = e.file_name();

        file_name.to_string_lossy().starts_with("nvram_") && file_name.to_string_lossy().ends_with(".txt")
    });

    for file in files {
        let text = fs::read_to_string(file.path())?;
        let mut bytes: Vec<u8> = vec![];

        for line in text
            .lines()
            .map(|line| strip_after_char(line, '#').trim_end())
            .filter(|line| !line.is_empty())
        {
            bytes.extend_from_slice(line.as_bytes());
            bytes.extend_from_slice(&b"\x00"[..]);
        }

        bytes.extend_from_slice(&b"\x00\x00"[..]);

        let target = file.path().with_extension("bin");

        fs::write(&target, bytes)?;
        println!("Wrote {:?}", target.file_name().unwrap_or_default().to_owned());
    }

    Ok(())
}

```

### Core Architecture Module: `cyw43-pio/src/lib.rs`
```
#![no_std]
#![allow(async_fn_in_trait)]
#![doc = include_str!("../README.md")]
#![warn(missing_docs)]

use core::slice;

use cyw43::SpiBusCyw43;
use embassy_rp::Peri;
use embassy_rp::clocks::clk_sys_freq;
use embassy_rp::dma::Channel;
use embassy_rp::gpio::{Drive, Level, Output, Pull, SlewRate};
use embassy_rp::mode::Async;
use embassy_rp::pio::program::pio_asm;
use embassy_rp::pio::{Common, Config, Direction, Instance, Irq, PioPin, ShiftDirection, StateMachine};
use fixed::FixedU32;
use fixed::types::extra::U8;

/// SPI comms driven by PIO.
pub struct PioSpi<'d, PIO: Instance, const SM: usize> {
    cs: Output<'d>,
    sm: StateMachine<'d, PIO, SM>,
    irq: Irq<'d, PIO, 0>,
    dma_tx: Channel<'d, Async>,
    dma_rx: Channel<'d, Async>,
    wrap_target: u8,
    pin_io: embassy_rp::pio::Pin<'d, PIO>,
}

/// Clock divider used for most applications
/// With default core clock configuration:
/// RP2350: 150Mhz / 2 = 75Mhz pio clock -> 37.5Mhz GSPI clock
/// RP2040: 133Mhz / 2 = 66.5Mhz pio clock -> 33.25Mhz GSPI clock
pub const DEFAULT_CLOCK_DIVIDER: FixedU32<U8> = FixedU32::from_bits(0x0200);

/// Clock divider used to overclock the cyw43
/// With default core clock configuration:
/// RP2350: 150Mhz / 1 = 150Mhz pio clock -> 75Mhz GSPI clock (50% greater that manufacturer
/// recommended 50Mhz)
/// RP2040: 133Mhz / 1 = 133Mhz pio clock -> 66.5Mhz GSPI clock (33% greater that manufacturer
/// recommended 50Mhz)
pub const OVERCLOCK_CLOCK_DIVIDER: FixedU32<U8> = FixedU32::from_bits(0x0100);

/// Clock divider used with the RM2
/// With default core clock configuration:
/// RP2350: 150Mhz / 3 = 50Mhz pio clock -> 25Mhz GSPI clock
/// RP2040: 133Mhz / 3 = 44.33Mhz pio clock -> 22.16Mhz GSPI clock
pub const RM2_CLOCK_DIVIDER: FixedU32<U8> = FixedU32::from_bits(0x0300);

impl<'d, PIO, const SM: usize> PioSpi<'d, PIO, SM>
where
    PIO: Instance,
{
    /// Create a new instance of PioSpi.
    pub fn new(
        common: &mut Common<'d, PIO>,
        mut sm: StateMachine<'d, PIO, SM>,
        clock_divider: FixedU32<U8>,
        irq: Irq<'d, PIO, 0>,
        cs: Output<'d>,
        dio: Peri<'d, impl PioPin>,
        clk: Peri<'d, impl PioPin>,
        dma_tx: Channel<'d, Async>,
        dma_rx: Channel<'d, Async>,
    ) -> Self {
        let effective_pio_frequency = (clk_sys_freq() as f32 / clock_divider.to_num::<f32>()) as u32;

        #[cfg(feature = "defmt")]
        defmt::trace!("Effective pio frequency: {}Hz", effective_pio_frequency);

        // Non-integer pio clock dividers are achieved by introducing clock jitter resulting in a
        // combination of long and short cycles. The long and short cycles average to achieve the
        // requested clock speed.
        // This can be a problem for peripherals that expect a consistent clock / have a clock
        // speed upper bound that is violated by the short cycles. The cyw43 seems to handle the
        // jitter well, but we emit a warning to recommend an integer divider anyway.
        if clock_divider.frac() != FixedU32::<U8>::ZERO {
            #[cfg(feature = "defmt")]
            defmt::trace!(
                "Configured clock divider is not a whole number. Some clock cycles may violate the maximum recommended GSPI speed. Use at your own risk."
            );
        }

        // Different pio programs must be used for different pio clock speeds.
        // The programs used below are based on the pico SDK: https://github.com/raspberrypi/pico-sdk/blob/master/src/rp2_common/pico_cyw43_driver/cyw43_bus_pio_spi.pio
        // The clock speed cutoff for each program has been determined experimentally:
        // > 100Mhz -> Overclock program
        // [75Mhz, 100Mhz] -> High speed program
        // [0, 75Mhz) -> Low speed program
        let loaded_program = if effective_pio_frequency > 100_000_000 {
            // Any frequency > 100Mhz is overclocking the chip (manufacturer recommends max 50Mhz GSPI
            // clock)
            // Example:
            // * RP2040 @ 133Mhz (stock) with OVERCLOCK_CLOCK_DIVIDER (133MHz)
            #[cfg(feature = "defmt")]
            defmt::trace!(
                "Configured clock divider results in a GSPI frequency greater than the manufacturer recommendation (50Mhz). Use at your own risk."
            );

            let overclock_program = pio_asm!(
                ".side_set 1"

                ".wrap_target"
                // write out x-1 bits
                "lp:"
                "out pins, 1    side 0"
                "jmp x-- lp     side 1"
                // switch directions
                "set pindirs, 0 side 0"
                "nop            side 1"
                "nop            side 0"
                // read in y-1 bits
                "lp2:"
                "in pins, 1     side 1"
                "jmp y-- lp2    side 0"

                // wait for event and irq host
                "wait 1 pin 0   side 0"
                "irq 0          side 0"

                ".wrap"
            );
            common.load_program(&overclock_program.program)
        } else if effective_pio_frequency >= 75_000_000 {
            // Experimentally determined cutoff.
            // Notably includes the stock RP2350 configured with clk_div of 2 (150Mhz base clock / 2 = 75Mhz)
            // but does not include stock RP2040 configured with clk_div of 2 (133Mhz base clock / 2 = 66.5Mhz)
            // Example:
            // * RP2350 @ 150Mhz (stock) with DEFAULT_CLOCK_DIVIDER (75Mhz)
            // * RP2XXX @ 200Mhz with DEFAULT_CLOCK_DIVIDER (100Mhz)
            #[cfg(feature = "defmt")]
            defmt::trace!("Using high speed pio program.");
            let high_speed_program = pio_asm!(
                ".side_set 1"

                ".wrap_target"
                // write out x-1 bits
                "lp:"
                "out pins, 1    side 0"
                "jmp x-- lp     side 1"
                // switch directions
                "set pindirs, 0 side 0"
                "nop            side 1"
                // read in y-1 bits
                "lp2:"
                "in pins, 1     side 0"
                "jmp y-- lp2    side 1"

                // wait for event and irq host
                "wait 1 pin 0   side 0"
                "irq 0          side 0"

                ".wrap"
            );
            common.load_program(&high_speed_program.program)
        } else {
            // Low speed
            // Examples:
            // * RP2040 @ 133Mhz (stock) with DEFAULT_CLOCK_DIVIDER (66.5Mhz)
            // * RP2040 @ 133Mhz (stock) with RM2_CLOCK_DIVIDER (44.3Mhz)
            // * RP2350 @ 150Mhz (stock) with RM2_CLOCK_DIVIDER (50Mhz)
            #[cfg(feature = "defmt")]
            defmt::trace!("Using low speed pio program.");
            let low_speed_program = pio_asm!(
                ".side_set 1"

                ".wrap_target"
                // write out x-1 bits
                "lp:"
                "out pins, 1    side 0"
                "jmp x-- lp     side 1"
                // switch directions
                "set pindirs, 0 side 0"
                "nop            side 0"
                // read in y-1 bits
                "lp2:"
                "in pins, 1     side 1"
                "jmp y-- lp2    side 0"

                // wait for event and irq host
                "wait 1 pin 0   side 0"
                "irq 0          side 0"

                ".wrap"
            );
            common.load_program(&low_speed_program.program)
        };

        let mut pin_io: embassy_rp::pio::Pin<PIO> = common.make_pio_pin(dio);
        pin_io.set_pull(Pull::None);
        pin_io.set_schmitt(true);
        pin_io.set_drive_strength(Drive::_12mA);
        pin_io.set_slew_rate(SlewRate::Fast);

        let mut pin_clk = common.make_pio_pin(clk);
        pin_clk.set_drive_strength(Drive::_12mA);
        pin_clk.set_slew_rate(SlewRate::Fast);

        let mut cfg = Config::default();
        cfg.use_program(&loaded_program, &
```

### Core Architecture Module: `cyw43/src/bluetooth.rs`
```
use core::cell::RefCell;
use core::convert::Infallible;
use core::future::Future;
use core::mem::MaybeUninit;

use aligned::{A4, Aligned};
use bt_hci_transport::{PacketToController, ReadHciError};
use embassy_futures::yield_now;
use embassy_sync::blocking_mutex::raw::NoopRawMutex;
use embassy_sync::zerocopy_channel;
use embassy_time::{Duration, Timer};
use embedded_io_async::ErrorKind;

use crate::consts::*;
use crate::runner::Bus;
pub use crate::spi::SpiBusCyw43;
use crate::util::round_up;
use crate::{ChipInfo, Cyw43439, SealedChip, util};

const CHIP: ChipInfo = Cyw43439::INFO;

pub(crate) struct BtState {
    rx: [BtPacketBuf; 4],
    tx: [BtPacketBuf; 4],
    inner: MaybeUninit<BtStateInnre<'static>>,
}

impl BtState {
    pub const fn new() -> Self {
        Self {
            rx: [const { BtPacketBuf::new() }; 4],
            tx: [const { BtPacketBuf::new() }; 4],
            inner: MaybeUninit::uninit(),
        }
    }
}

struct BtStateInnre<'d> {
    rx: zerocopy_channel::Channel<'d, NoopRawMutex, BtPacketBuf>,
    tx: zerocopy_channel::Channel<'d, NoopRawMutex, BtPacketBuf>,
}

/// Bluetooth driver.
pub struct BtDriver<'d> {
    rx: RefCell<zerocopy_channel::Receiver<'d, NoopRawMutex, BtPacketBuf>>,
    tx: RefCell<zerocopy_channel::Sender<'d, NoopRawMutex, BtPacketBuf>>,
}

pub(crate) struct BtRunner<'d> {
    pub(crate) tx_chan: zerocopy_channel::Receiver<'d, NoopRawMutex, BtPacketBuf>,
    rx_chan: zerocopy_channel::Sender<'d, NoopRawMutex, BtPacketBuf>,

    // Bluetooth circular buffers
    addr: u32,
    h2b_write_pointer: u32,
    b2h_read_pointer: u32,
    host_ctrl: HostCtrl,
}

/// Host-owned BTSDIO control bits.
///
/// Mirrors pico-sdk's Infineon-supplied WiFi/BT corruption fix
/// (`8dbc6f20`, #1362): backplane register reads are not authoritative for
/// host-owned state when both radios are fully utilized.
#[derive(Default)]
struct HostCtrl(u32);

impl HostCtrl {
    const fn new() -> Self {
        Self(0)
    }

    const fn value(&self) -> u32 {
        self.0
    }

    fn set_awake(&mut self, awake: bool) -> Option<u32> {
        let old = self.0;
        if awake {
            self.0 |= BTSDIO_REG_WAKE_BT_BITMASK;
        } else {
            self.0 &= !BTSDIO_REG_WAKE_BT_BITMASK;
        }
        (self.0 != old).then_some(self.0)
    }

    fn set_host_ready(&mut self) -> u32 {
        self.0 |= BTSDIO_REG_SW_RDY_BITMASK;
        self.0
    }

    fn set_intr(&mut self) -> u32 {
        self.0 |= BTSDIO_REG_DATA_VALID_BITMASK;
        self.0
    }

    fn toggle_intr(&mut self) -> u32 {
        self.0 ^= BTSDIO_REG_DATA_VALID_BITMASK;
        self.0
    }
}

const BT_HCI_MTU: usize = 1024;

/// Represents a packet of size MTU.
pub(crate) struct BtPacketBuf {
    pub(crate) len: usize,
    pub(crate) buf: [u8; BT_HCI_MTU],
}

impl BtPacketBuf {
    /// Create a new packet buffer.
    pub const fn new() -> Self {
        Self {
            len: 0,
            buf: [0; BT_HCI_MTU],
        }
    }
}

pub(crate) fn new<'d>(state: &'d mut BtState) -> (BtRunner<'d>, BtDriver<'d>) {
    // safety: this is a self-referential struct, however:
    // - it can't move while the `'d` borrow is active.
    // - when the borrow ends, the dangling references inside the MaybeUninit will never be used again.
    let state_uninit: *mut MaybeUninit<BtStateInnre<'d>> =
        (&mut state.inner as *mut MaybeUninit<BtStateInnre<'static>>).cast();
    let state = unsafe { &mut *state_uninit }.write(BtStateInnre {
        rx: zerocopy_channel::Channel::new(&mut state.rx[..]),
        tx: zerocopy_channel::Channel::new(&mut state.tx[..]),
    });

    let (rx_sender, rx_receiver) = state.rx.split();
    let (tx_sender, tx_receiver) = state.tx.split();

    (
        BtRunner {
            tx_chan: tx_receiver,
            rx_chan: rx_sender,

            addr: 0,
            h2b_write_pointer: 0,
            b2h_read_pointer: 0,
            host_ctrl: HostCtrl::new(),
        },
        BtDriver {
            rx: RefCell::new(rx_receiver),
            tx: RefCell::new(tx_sender),
        },
    )
}

pub(crate) struct CybtFwCb<'a> {
    pub p_next_line_start: &'a [u8],
}

pub(crate) struct HexFileData<'a> {
    pub addr_mode: i32,
    pub hi_addr: u16,
    pub dest_addr: u32,
    pub p_ds: &'a mut [u8],
}

pub(crate) fn read_firmware_patch_line(p_btfw_cb: &mut CybtFwCb, hfd: &mut HexFileData) -> u32 {
    let mut abs_base_addr32 = 0;

    loop {
        let num_bytes = p_btfw_cb.p_next_line_start[0];
        p_btfw_cb.p_next_line_start = &p_btfw_cb.p_next_line_start[1..];

        let addr = (p_btfw_cb.p_next_line_start[0] as u16) << 8 | p_btfw_cb.p_next_line_start[1] as u16;
        p_btfw_cb.p_next_line_start = &p_btfw_cb.p_next_line_start[2..];

        let line_type = p_btfw_cb.p_next_line_start[0];
        p_btfw_cb.p_next_line_start = &p_btfw_cb.p_next_line_start[1..];

        if num_bytes == 0 {
            break;
        }

        hfd.p_ds[..num_bytes as usize].copy_from_slice(&p_btfw_cb.p_next_line_start[..num_bytes as usize]);
        p_btfw_cb.p_next_line_start = &p_btfw_cb.p_next_line_start[num_bytes as usize..];

        match line_type {
            BTFW_HEX_LINE_TYPE_EXTENDED_ADDRESS => {
                hfd.hi_addr = (hfd.p_ds[0] as u16) << 8 | hfd.p_ds[1] as u16;
                hfd.addr_mode = BTFW_ADDR_MODE_EXTENDED;
            }
            BTFW_HEX_LINE_TYPE_EXTENDED_SEGMENT_ADDRESS => {
                hfd.hi_addr = (hfd.p_ds[0] as u16) << 8 | hfd.p_ds[1] as u16;
                hfd.addr_mode = BTFW_ADDR_MODE_SEGMENT;
            }
            BTFW_HEX_LINE_TYPE_ABSOLUTE_32BIT_ADDRESS => {
                abs_base_addr32 = (hfd.p_ds[0] as u32) << 24
                    | (hfd.p_ds[1] as u32) << 16
                    | (hfd.p_ds[2] as u32) << 8
                    | hfd.p_ds[3] as u32;
                hfd.addr_mode = BTFW_ADDR_MODE_LINEAR32;
            }
            BTFW_HEX_LINE_TYPE_DATA => {
                hfd.dest_addr = addr as u32;
                match hfd.addr_mode {
                    BTFW_ADDR_MODE_EXTENDED => hfd.dest_addr += (hfd.hi_addr as u32) << 16,
                    BTFW_ADDR_MODE_SEGMENT => hfd.dest_addr += (hfd.hi_addr as u32) << 4,
                    BTFW_ADDR_MODE_LINEAR32 => hfd.dest_addr += abs_base_addr32,
                    _ => {}
                }
                return num_bytes as u32;
            }
            _ => {}
        }
    }
    0
}

impl<'a> BtRunner<'a> {
    pub(crate) async fn init_bluetooth(&mut self, bus: &mut impl Bus, firmware: &[u8], buf: &mut Aligned<A4, [u8]>) {
        trace!("init_bluetooth");
        bus.bp_write32(CHIP.bluetooth_base_address + BT2WLAN_PWRUP_ADDR, BT2WLAN_PWRUP_WAKE)
            .await;
        Timer::after(Duration::from_millis(2)).await;
        self.upload_bluetooth_firmware(bus, firmware, buf).await;
        self.wait_bt_ready(bus).await;
        self.init_bt_buffers(bus).await;
        self.wait_bt_awake(bus).await;
        self.bt_set_host_ready(bus).await;
        self.bt_toggle_intr(bus).await;
    }

    pub(crate) async fn upload_bluetooth_firmware(
        &mut self,
        bus: &mut impl Bus,
        firmware: &[u8],
        buf: &mut Aligned<A4, [u8]>,
    ) {
        // read version
        let version_length = firmware[0];
        let _version = &firmware[1..=version_length as usize];
        // skip version + 1 extra byte as per cybt_shared_bus_driver.c
        let firmware = &firmware[version_length as usize + 2..];
        // buffers
        let mut data_buffer: [u8; 0x100] = [0; 0x100];
        let mut aligned_data_buffer: [u8; 0x100] = [0; 0x100];
        // structs
        let mut btfw_cb = CybtFwCb {
            p_next_line_start: firmware,
        };
        let mut hfd = HexFileData {
            addr_mode: BTFW_ADDR_MODE_EXTENDED,
            hi_addr: 0,
            dest_addr: 0,
            p_ds: &mut data_buffer,
        };
        loop {
            let num_fw_bytes = read_firmware_patch_line(&mut btfw_cb, &mut hf
```

### Core Architecture Module: `cyw43/src/chip.rs`
```
//! Replicate `whd_chip.c` functionality

use embassy_time::{Duration, Timer};

use crate::consts::*;
use crate::runner::Bus;
use crate::util::try_until;
use crate::{Chip, ChipId, Core, WithContext};

/// Returns `true` is the core identified by the provided coreId is up, otherwise `false`
pub async fn check_device_core_is_up(bus: &mut impl Bus, chip: impl Chip, core: Core) -> crate::Result<()> {
    let base = chip.base_addr(core);

    let io = bus.bp_read8(base + AI_IOCTRL_OFFSET).await;
    if io & (AI_IOCTRL_BIT_FGC | AI_IOCTRL_BIT_CLOCK_EN) != AI_IOCTRL_BIT_CLOCK_EN {
        return err!("device_core_is_up: returning false due to bad ioctrl {:02x}", io);
    }

    let r = bus.bp_read8(base + AI_RESETCTRL_OFFSET).await;
    if r & (AI_RESETCTRL_BIT_RESET) != 0 {
        return err!("device_core_is_up: returning false due to bad resetctrl {:02x}", r);
    }

    Ok(())
}

/// Resets the core identified by the provided coreId
pub async fn reset_core(
    bus: &mut impl Bus,
    chip: impl Chip,
    core: Core,
    halt: bool,
    reset_halt: bool,
) -> crate::Result<()> {
    let base = chip.base_addr(core);

    async fn wait_for_backplane_idle(bus: &mut impl Bus, base: u32) -> crate::Result<()> {
        try_until(
            async || bus.bp_read8(base + AI_RESETSTATUS_OFFSET).await != 0,
            Duration::from_millis(300),
        )
        .await
        .ctx("timeout while waiting for backplane idle")
    }

    // ensure there are no pending backplane operations
    wait_for_backplane_idle(bus, base).await?;

    // put core into reset state
    bus.bp_write8(base + AI_RESETCTRL_OFFSET, AI_RESETCTRL_BIT_RESET).await;

    // ensure there are no pending backplane operations
    wait_for_backplane_idle(bus, base).await?;

    bus.bp_write8(
        base + AI_IOCTRL_OFFSET,
        if halt || reset_halt {
            AI_IOCTRL_BIT_CPUHALT | AI_IOCTRL_BIT_FGC | AI_IOCTRL_BIT_CLOCK_EN
        } else {
            AI_IOCTRL_BIT_FGC | AI_IOCTRL_BIT_CLOCK_EN
        },
    )
    .await;

    // whd tries ten times to take core out of reset
    let mut reset_state: u8 = 0;
    for _ in 0..10 {
        // ensure there are no pending backplane operations
        wait_for_backplane_idle(bus, base).await?;

        // take core out of reset
        bus.bp_write8(base + AI_RESETCTRL_OFFSET, 0).await;

        // ensure there are no pending backplane operations
        wait_for_backplane_idle(bus, base).await?;

        // verify the core is out of reset
        reset_state = bus.bp_read8(base + AI_RESETCTRL_OFFSET).await;
        if reset_state == 0 {
            break;
        }
    }

    bus.bp_write8(
        base + AI_IOCTRL_OFFSET,
        if halt || reset_halt {
            AI_IOCTRL_BIT_CPUHALT | AI_IOCTRL_BIT_CLOCK_EN
        } else {
            AI_IOCTRL_BIT_CLOCK_EN
        },
    )
    .await;

    match reset_state {
        0 => Ok(()),
        _ => err!("reset_core: failed to take core out of reset {:02x}", reset_state),
    }
}

/// Disables the core identified by the provided coreId
pub async fn disable_device_core(bus: &mut impl Bus, chip: impl Chip, core: Core, halt: bool) -> crate::Result<()> {
    let base = chip.base_addr(core);

    // read the reset control
    let _ = bus.bp_read8(base + AI_RESETCTRL_OFFSET);

    // read the reset control and check if it is already in reset
    if bus.bp_read8(base + AI_RESETCTRL_OFFSET).await & AI_RESETCTRL_BIT_RESET != 0 {
        // core already in reset
        return Ok(());
    }

    // Write 0 to the IO control and read it back
    bus.bp_write8(base + AI_IOCTRL_OFFSET, if halt { AI_IOCTRL_BIT_CPUHALT } else { 0 })
        .await;

    let _ = bus.bp_read8(base + AI_IOCTRL_OFFSET);

    Timer::after_millis(1).await;

    // put core into reset state
    bus.bp_write8(base + AI_RESETCTRL_OFFSET, AI_RESETCTRL_BIT_RESET).await;

    Timer::after_millis(1).await;

    Ok(())
}

/// Resets the core identified by the provided coreId
pub async fn reset_device_core(bus: &mut impl Bus, chip: impl Chip, core: Core, halt: bool) -> crate::Result<()> {
    let base = chip.base_addr(core);

    disable_device_core(bus, chip, core, halt).await?;

    bus.bp_write8(
        base + AI_IOCTRL_OFFSET,
        if halt {
            AI_IOCTRL_BIT_CPUHALT | AI_IOCTRL_BIT_FGC | AI_IOCTRL_BIT_CLOCK_EN
        } else {
            AI_IOCTRL_BIT_FGC | AI_IOCTRL_BIT_CLOCK_EN
        },
    )
    .await;

    let _ = bus.bp_read8(base + AI_IOCTRL_OFFSET).await;
    bus.bp_write8(base + AI_RESETCTRL_OFFSET, 0).await;

    Timer::after_millis(1).await;

    bus.bp_write8(
        base + AI_IOCTRL_OFFSET,
        if halt {
            AI_IOCTRL_BIT_CPUHALT | AI_IOCTRL_BIT_CLOCK_EN
        } else {
            AI_IOCTRL_BIT_CLOCK_EN
        },
    )
    .await;

    let _ = bus.bp_read8(base + AI_IOCTRL_OFFSET).await;
    Timer::after_millis(1).await;

    Ok(())
}

pub async fn chip_specific_socsram_init(bus: &mut impl Bus, chip: impl Chip) -> crate::Result<()> {
    if matches!(chip.id(), ChipId::C43439) {
        // this is 4343x specific stuff: Disable remap for SRAM_3
        bus.bp_write32(chip.socsram_base_address() + 0x10, 3).await;
        bus.bp_write32(chip.socsram_base_address() + 0x44, 0).await;
    }

    Ok(())
}

```

### Core Architecture Module: `cyw43/src/consts.rs`
```
#![allow(unused)]

pub(crate) const FUNC_BUS: u8 = 0;
pub(crate) const FUNC_BACKPLANE: u8 = 1;
pub(crate) const FUNC_WLAN: u8 = 2;
pub(crate) const FUNC_BT: u8 = 3;

// Register addresses
pub(crate) const REG_BUS_CTRL: u32 = 0x0;
pub(crate) const REG_BUS_RESPONSE_DELAY: u32 = 0x1;
pub(crate) const REG_BUS_STATUS_ENABLE: u32 = 0x2;
pub(crate) const REG_BUS_INTERRUPT: u32 = 0x04; // 16 bits - Interrupt status
pub(crate) const REG_BUS_INTERRUPT_ENABLE: u32 = 0x06; // 16 bits - Interrupt mask
pub(crate) const REG_BUS_STATUS: u32 = 0x8;
pub(crate) const REG_BUS_TEST_RO: u32 = 0x14;
pub(crate) const REG_BUS_TEST_RW: u32 = 0x18;
pub(crate) const REG_BUS_RESP_DELAY: u32 = 0x1c;

// SPI_BUS_CONTROL Bits
pub(crate) const WORD_LENGTH_32: u32 = 0x1;
pub(crate) const ENDIAN_BIG: u32 = 0x2;
pub(crate) const CLOCK_PHASE: u32 = 0x4;
pub(crate) const CLOCK_POLARITY: u32 = 0x8;
pub(crate) const HIGH_SPEED: u32 = 0x10;
pub(crate) const INTERRUPT_POLARITY_HIGH: u32 = 0x20;
pub(crate) const WAKE_UP: u32 = 0x80;

// SPI_STATUS_ENABLE bits
pub(crate) const STATUS_ENABLE: u32 = 0x01;
pub(crate) const INTR_WITH_STATUS: u32 = 0x02;
pub(crate) const RESP_DELAY_ALL: u32 = 0x04;
pub(crate) const DWORD_PKT_LEN_EN: u32 = 0x08;
pub(crate) const CMD_ERR_CHK_EN: u32 = 0x20;
pub(crate) const DATA_ERR_CHK_EN: u32 = 0x40;

// SPI_STATUS_REGISTER bits
pub(crate) const SPI_STATUS_REGISTER: u32 = 0x00000008;
pub(crate) const INITIAL_READ: usize = 0x04;

pub(crate) const STATUS_DATA_NOT_AVAILABLE: u32 = 0x00000001;
pub(crate) const STATUS_UNDERFLOW: u32 = 0x00000002;
pub(crate) const STATUS_OVERFLOW: u32 = 0x00000004;
pub(crate) const STATUS_F2_INTR: u32 = 0x00000008;
pub(crate) const STATUS_F3_INTR: u32 = 0x00000010;
pub(crate) const STATUS_F2_RX_READY: u32 = 0x00000020;
pub(crate) const STATUS_F3_RX_READY: u32 = 0x00000040;
pub(crate) const STATUS_HOST_CMD_DATA_ERR: u32 = 0x00000080;
pub(crate) const STATUS_F2_PKT_AVAILABLE: u32 = 0x00000100;
pub(crate) const STATUS_F2_PKT_LEN_MASK: u32 = 0x000FFE00;
pub(crate) const STATUS_F2_PKT_LEN_SHIFT: u32 = 9;
pub(crate) const STATUS_F3_PKT_AVAILABLE: u32 = 0x00100000;
pub(crate) const STATUS_F3_PKT_LEN_MASK: u32 = 0xFFE00000;
pub(crate) const STATUS_F3_PKT_LEN_SHIFT: u32 = 21;

pub(crate) const REG_BACKPLANE_GPIO_SELECT: u32 = 0x10005;
pub(crate) const REG_BACKPLANE_GPIO_OUTPUT: u32 = 0x10006;
pub(crate) const REG_BACKPLANE_GPIO_ENABLE: u32 = 0x10007;
pub(crate) const REG_BACKPLANE_FUNCTION2_WATERMARK: u32 = 0x10008;
pub(crate) const REG_BACKPLANE_DEVICE_CONTROL: u32 = 0x10009;
pub(crate) const REG_BACKPLANE_BACKPLANE_ADDRESS_LOW: u32 = 0x1000A;
pub(crate) const REG_BACKPLANE_BACKPLANE_ADDRESS_MID: u32 = 0x1000B;
pub(crate) const REG_BACKPLANE_BACKPLANE_ADDRESS_HIGH: u32 = 0x1000C;
pub(crate) const REG_BACKPLANE_FRAME_CONTROL: u32 = 0x1000D;
pub(crate) const REG_BACKPLANE_CHIP_CLOCK_CSR: u32 = 0x1000E;
pub(crate) const REG_BACKPLANE_PULL_UP: u32 = 0x1000F;
pub(crate) const REG_BACKPLANE_READ_FRAME_BC_LOW: u32 = 0x1001B;
pub(crate) const REG_BACKPLANE_READ_FRAME_BC_HIGH: u32 = 0x1001C;
pub(crate) const REG_BACKPLANE_WAKEUP_CTRL: u32 = 0x1001E;
pub(crate) const REG_BACKPLANE_SLEEP_CSR: u32 = 0x1001F;

pub(crate) const I_HMB_SW_MASK: u32 = 0xF0;
pub(crate) const I_HMB_FC_CHANGE: u32 = 1 << 5;
pub(crate) const FRAME_AVAILABLE_MASK: u32 = I_HMB_SW_MASK;
pub(crate) const SDIO_INT_STATUS: u32 = 0x20;
pub(crate) const SDIO_INT_HOST_MASK: u32 = 0x24;
pub(crate) const SDIO_FUNCTION_INT_MASK: u32 = 0x34;
pub(crate) const SDIO_INT_HOST_MASK_ALL: u8 = 0xFF;
pub(crate) const SDIO_FUNC_INT_MASK_F1: u8 = 0x02;
pub(crate) const CCCR_INT_ENABLE_MASTER: u8 = 0x01;
pub(crate) const SDIO_TO_SB_MAILBOX: u32 = 0x40;
pub(crate) const SDIO_TO_SB_MAILBOX_DATA: u32 = 0x48;
pub(crate) const SDIO_TO_HOST_MAILBOX_DATA: u32 = 0x4C;
pub(crate) const SDIO_SLEEP_CSR: u32 = 0x1001F;
pub(crate) const SBSDIO_SLPCSR_KEEP_WL_KS: u32 = 1 << 0;
pub(crate) const SBSDIO_SLPCSR_WL_DEVON: u32 = 1 << 1;

pub(crate) const SMB_DEV_INT: u32 = 1 << 3;
pub(crate) const SMB_INT_ACK: u32 = 1 << 1;
pub(crate) const I_HMB_HOST_INT: u32 = 1 << 7;
pub(crate) const I_HMB_DATA_FWHALT: u32 = 0x0010;

pub(crate) const HOSTINTMASK: u32 = I_HMB_SW_MASK;
pub(crate) const BUS_SD_DATA_WIDTH_MASK: u32 = 0x03;
pub(crate) const BUS_SD_DATA_WIDTH_4BIT: u32 = 0x02;
pub(crate) const SDIO_SPEED_EHS: u32 = 0x02;
pub(crate) const SDIOD_CCCR_BRCM_CARDCAP_SECURE_MODE: u32 = 0x80;
pub(crate) const SBSDIO_DEVICE_CTL: u32 = 0x10009;
pub(crate) const SDIOD_CCCR_BRCM_CARDCAP_CMD_NODEC: u32 = 0x08;
pub(crate) const SBSDIO_DEVCTL_ADDR_RST: u32 = 0x40;
pub(crate) const SDIO_CORE_CHIPID_REG: u32 = 0x330;

pub(crate) const SBSDIO_FUNC1_SBADDRLOW: u32 = 0x1000A;
pub(crate) const SBSDIO_FUNC1_SBADDRMID: u32 = 0x1000B;
pub(crate) const SBSDIO_FUNC1_SBADDRHIGH: u32 = 0x1000C;

pub(crate) const SPI_F2_WATERMARK: u8 = 0x20;
pub(crate) const SDIO_F2_WATERMARK: u8 = 0x08;

pub(crate) const BACKPLANE_WINDOW_SIZE: usize = 0x8000;
pub(crate) const BACKPLANE_ADDRESS_MASK: u32 = 0x7FFF;
pub(crate) const BACKPLANE_ADDRESS_32BIT_FLAG: u32 = 0x08000;
pub(crate) const BACKPLANE_MAX_TRANSFER_SIZE: usize = 64;
pub(crate) const BLOCK_BUFFER_SIZE: usize = 1024;
// Active Low Power (ALP) clock constants
pub(crate) const BACKPLANE_ALP_AVAIL_REQ: u8 = 0x08;
pub(crate) const BACKPLANE_ALP_AVAIL: u8 = 0x40;
pub(crate) const BACKPLANE_FORCE_HW_CLKREQ_OFF: u8 = 0x20;
pub(crate) const BACKPLANE_FORCE_ALP: u8 = 0x01;
pub(crate) const BACKPLANE_FORCE_HT: u32 = 0x02;
pub(crate) const BACKPLANE_HT_AVAIL_REQ: u8 = 0x10;
pub(crate) const SBSDIO_WCTRL_WL_WAKE_TILL_ALP_AVAIL: u8 = 1 << 0;

// Broadcom AMBA (Advanced Microcontroller Bus Architecture) Interconnect
// (AI) pub (crate) constants
pub(crate) const AI_IOCTRL_OFFSET: u32 = 0x408;
pub(crate) const AI_IOCTRL_BIT_FGC: u8 = 0x0002;
pub(crate) const AI_IOCTRL_BIT_CLOCK_EN: u8 = 0x0001;
pub(crate) const AI_IOCTRL_BIT_CPUHALT: u8 = 0x0020;

pub(crate) const AI_RESETCTRL_OFFSET: u32 = 0x800;
pub(crate) const AI_RESETCTRL_BIT_RESET: u8 = 1;

pub(crate) const AI_RESETSTATUS_OFFSET: u32 = 0x804;

pub(crate) const TEST_PATTERN: u32 = 0x12345678;
pub(crate) const FEEDBEAD: u32 = 0xFEEDBEAD;

// SPI_INTERRUPT_REGISTER and SPI_INTERRUPT_ENABLE_REGISTER Bits
pub(crate) const IRQ_DATA_UNAVAILABLE: u16 = 0x0001; // Requested data not available; Clear by writing a "1"
pub(crate) const IRQ_F2_F3_FIFO_RD_UNDERFLOW: u16 = 0x0002;
pub(crate) const IRQ_F2_F3_FIFO_WR_OVERFLOW: u16 = 0x0004;
pub(crate) const IRQ_COMMAND_ERROR: u16 = 0x0008; // Cleared by writing 1
pub(crate) const IRQ_DATA_ERROR: u16 = 0x0010; // Cleared by writing 1
pub(crate) const IRQ_F2_PACKET_AVAILABLE: u16 = 0x0020;
pub(crate) const IRQ_F3_PACKET_AVAILABLE: u16 = 0x0040;
pub(crate) const IRQ_F1_OVERFLOW: u16 = 0x0080; // Due to last write. Bkplane has pending write requests
pub(crate) const IRQ_MISC_INTR0: u16 = 0x0100;
pub(crate) const IRQ_MISC_INTR1: u16 = 0x0200;
pub(crate) const IRQ_MISC_INTR2: u16 = 0x0400;
pub(crate) const IRQ_MISC_INTR3: u16 = 0x0800;
pub(crate) const IRQ_MISC_INTR4: u16 = 0x1000;
pub(crate) const IRQ_F1_INTR: u16 = 0x2000;
pub(crate) const IRQ_F2_INTR: u16 = 0x4000;
pub(crate) const IRQ_F3_INTR: u16 = 0x8000;

pub(crate) const CHANNEL_TYPE_CONTROL: u8 = 0;
pub(crate) const CHANNEL_TYPE_EVENT: u8 = 1;
pub(crate) const CHANNEL_TYPE_DATA: u8 = 2;

// CYW_SPID command structure constants.
pub(crate) const WRITE: bool = true;
pub(crate) const READ: bool = false;
pub(crate) const INC_ADDR: bool = true;
pub(crate) const FIXED_ADDR: bool = false;

pub(crate) const AES_ENABLED: u32 = 0x0004;
pub(crate) const WPA3_SECURITY: u32 = 0x01000000;
pub(crate) const WPA2_SECURITY: u32 = 0x00400000;

pub(crate) const MIN_PSK_LEN: usize = 8;
pub(crate) const MAX_PSK_LEN: usize = 64;

// Bluetooth firmware extraction constants.
pub(crate) const BTFW_ADDR_MODE_UNKNOWN: i32 = 0;
pub(crate) const BTFW_ADDR_MODE_EXTENDED: i32 = 1;
pub(crate) const BTFW_ADDR_MODE_SEGMENT: i32 = 2;
pub(crate) const BTFW_ADDR_MODE_LINEAR32: i32 = 3;

pub(crate) const BTFW_HEX_LINE
```

### Core Architecture Module: `cyw43/src/control.rs`
```
use core::cmp::{max, min};
use core::iter::zip;
use core::sync::atomic::AtomicBool;
use core::sync::atomic::Ordering::Relaxed;

use embassy_net_driver_channel as ch;
use embassy_net_driver_channel::driver::HardwareAddress;
use embassy_time::{Duration, Timer};

use crate::consts::*;
use crate::events::{Event, EventSubscriber, Events};
use crate::fmt::Bytes;
use crate::ioctl::{IoctlState, IoctlType};
use crate::structs::*;
use crate::{PowerManagementMode, countries, events};

/// Join errors.
#[derive(Debug)]
#[cfg_attr(feature = "defmt", derive(defmt::Format))]
pub enum JoinError {
    /// The passphrase is invalid for the selected authentication mode.
    InvalidPassphrase,
    /// Network not found.
    NetworkNotFound,
    /// Failure to join network. Contains the status code from the SET_SSID event.
    JoinFailure(u8),
    /// Authentication failure for a secure network.
    AuthenticationFailure,
}

/// Control driver.
pub struct Control<'a> {
    state_ch: ch::StateRunner<'a>,
    events: &'a Events,
    ioctl_state: &'a IoctlState,
    secure_network: &'a AtomicBool,
}

/// WiFi scan type.
#[derive(Copy, Clone, Debug)]
#[cfg_attr(feature = "defmt", derive(defmt::Format))]
pub enum ScanType {
    /// Active scan: the station actively transmits probes that make APs respond.
    /// Faster, but uses more power.
    Active,
    /// Passive scan: the station doesn't transmit any probes, just listens for beacons.
    /// Slower, but uses less power.
    Passive,
}

/// Scan options.
#[derive(Clone, Debug)]
#[cfg_attr(feature = "defmt", derive(defmt::Format))]
#[non_exhaustive]
pub struct ScanOptions {
    /// SSID to scan for.
    pub ssid: Option<heapless::String<32>>,
    /// If set to `None`, all APs will be returned. If set to `Some`, only APs
    /// with the specified BSSID will be returned.
    pub bssid: Option<[u8; 6]>,
    /// Number of probes to send on each channel.
    pub nprobes: Option<u16>,
    /// Time to spend waiting on the home channel.
    pub home_time: Option<Duration>,
    /// Scan type: active or passive.
    pub scan_type: ScanType,
    /// Period of time to wait on each channel when passive scanning.
    pub dwell_time: Option<Duration>,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            ssid: None,
            bssid: None,
            nprobes: None,
            home_time: None,
            scan_type: ScanType::Passive,
            dwell_time: None,
        }
    }
}

/// Authentication type, used in [`JoinOptions::auth`].
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "defmt", derive(defmt::Format))]
pub enum JoinAuth {
    /// Open network
    Open,
    /// WPA only
    Wpa,
    /// WPA2 only
    Wpa2,
    /// WPA3 only
    Wpa3,
    /// WPA2 + WPA3
    Wpa2Wpa3,
}

/// Authentication type for an access point.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[cfg_attr(feature = "defmt", derive(defmt::Format))]
pub enum ApAuth {
    /// Open network.
    Open,
    /// WPA2 only.
    Wpa2,
    /// WPA3 only. Requires compatible CYW43 firmware and client support.
    Wpa3,
    /// WPA2 + WPA3 transition mode. WPA3 requires compatible CYW43 firmware and client support.
    Wpa2Wpa3,
}

/// Options for [`Control::join`].
#[derive(Clone, Debug)]
#[cfg_attr(feature = "defmt", derive(defmt::Format))]
#[non_exhaustive]
pub struct JoinOptions<'a> {
    /// Authentication type. Default `Wpa2Wpa3`.
    pub auth: JoinAuth,
    /// Enable TKIP encryption. Default false.
    pub cipher_tkip: bool,
    /// Enable AES encryption. Default true.
    pub cipher_aes: bool,
    /// Passphrase. Must contain between 8 and 64 bytes for an encrypted network.
    /// Default empty.
    pub passphrase: &'a [u8],
    /// If false, `passphrase` is the human-readable passphrase string.
    /// If true, `passphrase` is the result of applying the PBKDF2 hash to the
    /// passphrase string. This makes it possible to avoid storing unhashed passwords.
    ///
    /// Pre-hashed passphrases must contain exactly 32 bytes and are not compatible with WPA3.
    /// Default false.
    pub passphrase_is_prehashed: bool,
}

impl<'a> JoinOptions<'a> {
    /// Create a new `JoinOptions` for joining open networks.
    pub fn new_open() -> Self {
        Self {
            auth: JoinAuth::Open,
            cipher_tkip: false,
            cipher_aes: false,
            passphrase: &[],
            passphrase_is_prehashed: false,
        }
    }

    /// Create a new `JoinOptions` for joining encrypted networks.
    ///
    /// Defaults to supporting WPA2+WPA3 with AES only, you may edit
    /// the returned options to change this.
    pub fn new(passphrase: &'a [u8]) -> Self {
        let mut this = Self::default();
        this.passphrase = passphrase;
        this
    }
}

impl<'a> Default for JoinOptions<'a> {
    fn default() -> Self {
        Self {
            auth: JoinAuth::Wpa2Wpa3,
            cipher_tkip: false,
            cipher_aes: true,
            passphrase: &[],
            passphrase_is_prehashed: false,
        }
    }
}

fn validate_join_options(options: &JoinOptions<'_>) -> Result<(), JoinError> {
    if options.auth == JoinAuth::Open {
        return Ok(());
    }

    let valid = if options.passphrase_is_prehashed {
        matches!(options.auth, JoinAuth::Wpa | JoinAuth::Wpa2) && options.passphrase.len() == 32
    } else {
        (MIN_PSK_LEN..=MAX_PSK_LEN).contains(&options.passphrase.len())
    };

    if valid {
        Ok(())
    } else {
        Err(JoinError::InvalidPassphrase)
    }
}

impl<'a> Control<'a> {
    pub(crate) fn new(
        state_ch: ch::StateRunner<'a>,
        event_sub: &'a Events,
        ioctl_state: &'a IoctlState,
        secure_network: &'a AtomicBool,
    ) -> Self {
        Self {
            state_ch,
            events: event_sub,
            ioctl_state,
            secure_network,
        }
    }

    async fn load_clm(&mut self, clm: &[u8]) {
        const CHUNK_SIZE: usize = 1024;

        debug!("Downloading CLM...");

        let mut offs = 0;
        for chunk in clm.chunks(CHUNK_SIZE) {
            let mut flag = DOWNLOAD_FLAG_HANDLER_VER;
            if offs == 0 {
                flag |= DOWNLOAD_FLAG_BEGIN;
            }
            offs += chunk.len();
            if offs == clm.len() {
                flag |= DOWNLOAD_FLAG_END;
            }

            let header = DownloadHeader {
                flag,
                dload_type: DOWNLOAD_TYPE_CLM,
                len: chunk.len() as _,
                crc: 0,
            };
            let mut buf = [0; 8 + 12 + CHUNK_SIZE];
            buf[0..8].copy_from_slice(b"clmload\x00");
            buf[8..20].copy_from_slice(header.to_bytes());
            buf[20..][..chunk.len()].copy_from_slice(chunk);
            self.ioctl(IoctlType::Set, Ioctl::SetVar, 0, &mut buf[..8 + 12 + chunk.len()])
                .await;
        }

        // check clmload ok
        assert_eq!(self.get_iovar_u32("clmload_status").await, 0);
    }

    /// Initialize WiFi controller.
    pub async fn init(&mut self, clm: &[u8]) {
        self.load_clm(clm).await;

        debug!("Configuring misc stuff...");

        // Disable tx gloming which transfers multiple packets in one request.
        // 'glom' is short for "conglomerate" which means "gather together into
        // a compact mass".
        self.set_iovar_u32("bus:txglom", 0).await;
        self.set_iovar_u32("apsta", 1).await;

        // read MAC addr.
        let mac_addr = self.address().await;
        debug!("mac addr: {:02x}", Bytes(&mac_addr));

        let country = countries::WORLD_WIDE_XX;
        let country_info = CountryInfo {
            country_abbrev: [country.code[0], country.code[1], 0, 0],
            country_code: [country.code[0], country.code[1], 0, 0],
            rev: if country.rev == 0 { -1 } else { country.rev as _ },
        };
        self.set_iovar("country", country_info.to_bytes()).await;

        // set country takes some
```

### Core Architecture Module: `cyw43/src/countries.rs`
```
#![allow(unused)]

pub struct Country {
    pub code: [u8; 2],
    pub rev: u16,
}

/// AF Afghanistan
pub const AFGHANISTAN: Country = Country { code: *b"AF", rev: 0 };
/// AL Albania
pub const ALBANIA: Country = Country { code: *b"AL", rev: 0 };
/// DZ Algeria
pub const ALGERIA: Country = Country { code: *b"DZ", rev: 0 };
/// AS American_Samoa
pub const AMERICAN_SAMOA: Country = Country { code: *b"AS", rev: 0 };
/// AO Angola
pub const ANGOLA: Country = Country { code: *b"AO", rev: 0 };
/// AI Anguilla
pub const ANGUILLA: Country = Country { code: *b"AI", rev: 0 };
/// AG Antigua_and_Barbuda
pub const ANTIGUA_AND_BARBUDA: Country = Country { code: *b"AG", rev: 0 };
/// AR Argentina
pub const ARGENTINA: Country = Country { code: *b"AR", rev: 0 };
/// AM Armenia
pub const ARMENIA: Country = Country { code: *b"AM", rev: 0 };
/// AW Aruba
pub const ARUBA: Country = Country { code: *b"AW", rev: 0 };
/// AU Australia
pub const AUSTRALIA: Country = Country { code: *b"AU", rev: 0 };
/// AT Austria
pub const AUSTRIA: Country = Country { code: *b"AT", rev: 0 };
/// AZ Azerbaijan
pub const AZERBAIJAN: Country = Country { code: *b"AZ", rev: 0 };
/// BS Bahamas
pub const BAHAMAS: Country = Country { code: *b"BS", rev: 0 };
/// BH Bahrain
pub const BAHRAIN: Country = Country { code: *b"BH", rev: 0 };
/// 0B Baker_Island
pub const BAKER_ISLAND: Country = Country { code: *b"0B", rev: 0 };
/// BD Bangladesh
pub const BANGLADESH: Country = Country { code: *b"BD", rev: 0 };
/// BB Barbados
pub const BARBADOS: Country = Country { code: *b"BB", rev: 0 };
/// BY Belarus
pub const BELARUS: Country = Country { code: *b"BY", rev: 0 };
/// BE Belgium
pub const BELGIUM: Country = Country { code: *b"BE", rev: 0 };
/// BZ Belize
pub const BELIZE: Country = Country { code: *b"BZ", rev: 0 };
/// BJ Benin
pub const BENIN: Country = Country { code: *b"BJ", rev: 0 };
/// BM Bermuda
pub const BERMUDA: Country = Country { code: *b"BM", rev: 0 };
/// BT Bhutan
pub const BHUTAN: Country = Country { code: *b"BT", rev: 0 };
/// BO Bolivia
pub const BOLIVIA: Country = Country { code: *b"BO", rev: 0 };
/// BA Bosnia_and_Herzegovina
pub const BOSNIA_AND_HERZEGOVINA: Country = Country { code: *b"BA", rev: 0 };
/// BW Botswana
pub const BOTSWANA: Country = Country { code: *b"BW", rev: 0 };
/// BR Brazil
pub const BRAZIL: Country = Country { code: *b"BR", rev: 0 };
/// IO British_Indian_Ocean_Territory
pub const BRITISH_INDIAN_OCEAN_TERRITORY: Country = Country { code: *b"IO", rev: 0 };
/// BN Brunei_Darussalam
pub const BRUNEI_DARUSSALAM: Country = Country { code: *b"BN", rev: 0 };
/// BG Bulgaria
pub const BULGARIA: Country = Country { code: *b"BG", rev: 0 };
/// BF Burkina_Faso
pub const BURKINA_FASO: Country = Country { code: *b"BF", rev: 0 };
/// BI Burundi
pub const BURUNDI: Country = Country { code: *b"BI", rev: 0 };
/// KH Cambodia
pub const CAMBODIA: Country = Country { code: *b"KH", rev: 0 };
/// CM Cameroon
pub const CAMEROON: Country = Country { code: *b"CM", rev: 0 };
/// CA Canada
pub const CANADA: Country = Country { code: *b"CA", rev: 0 };
/// CA Canada Revision 950
pub const CANADA_REV950: Country = Country { code: *b"CA", rev: 950 };
/// CV Cape_Verde
pub const CAPE_VERDE: Country = Country { code: *b"CV", rev: 0 };
/// KY Cayman_Islands
pub const CAYMAN_ISLANDS: Country = Country { code: *b"KY", rev: 0 };
/// CF Central_African_Republic
pub const CENTRAL_AFRICAN_REPUBLIC: Country = Country { code: *b"CF", rev: 0 };
/// TD Chad
pub const CHAD: Country = Country { code: *b"TD", rev: 0 };
/// CL Chile
pub const CHILE: Country = Country { code: *b"CL", rev: 0 };
/// CN China
pub const CHINA: Country = Country { code: *b"CN", rev: 0 };
/// CX Christmas_Island
pub const CHRISTMAS_ISLAND: Country = Country { code: *b"CX", rev: 0 };
/// CO Colombia
pub const COLOMBIA: Country = Country { code: *b"CO", rev: 0 };
/// KM Comoros
pub const COMOROS: Country = Country { code: *b"KM", rev: 0 };
/// CG Congo
pub const CONGO: Country = Country { code: *b"CG", rev: 0 };
/// CD Congo,_The_Democratic_Republic_Of_The
pub const CONGO_THE_DEMOCRATIC_REPUBLIC_OF_THE: Country = Country { code: *b"CD", rev: 0 };
/// CR Costa_Rica
pub const COSTA_RICA: Country = Country { code: *b"CR", rev: 0 };
/// CI Cote_D'ivoire
pub const COTE_DIVOIRE: Country = Country { code: *b"CI", rev: 0 };
/// HR Croatia
pub const CROATIA: Country = Country { code: *b"HR", rev: 0 };
/// CU Cuba
pub const CUBA: Country = Country { code: *b"CU", rev: 0 };
/// CY Cyprus
pub const CYPRUS: Country = Country { code: *b"CY", rev: 0 };
/// CZ Czech_Republic
pub const CZECH_REPUBLIC: Country = Country { code: *b"CZ", rev: 0 };
/// DK Denmark
pub const DENMARK: Country = Country { code: *b"DK", rev: 0 };
/// DJ Djibouti
pub const DJIBOUTI: Country = Country { code: *b"DJ", rev: 0 };
/// DM Dominica
pub const DOMINICA: Country = Country { code: *b"DM", rev: 0 };
/// DO Dominican_Republic
pub const DOMINICAN_REPUBLIC: Country = Country { code: *b"DO", rev: 0 };
/// AU G'Day mate!
pub const DOWN_UNDER: Country = Country { code: *b"AU", rev: 0 };
/// EC Ecuador
pub const ECUADOR: Country = Country { code: *b"EC", rev: 0 };
/// EG Egypt
pub const EGYPT: Country = Country { code: *b"EG", rev: 0 };
/// SV El_Salvador
pub const EL_SALVADOR: Country = Country { code: *b"SV", rev: 0 };
/// GQ Equatorial_Guinea
pub const EQUATORIAL_GUINEA: Country = Country { code: *b"GQ", rev: 0 };
/// ER Eritrea
pub const ERITREA: Country = Country { code: *b"ER", rev: 0 };
/// EE Estonia
pub const ESTONIA: Country = Country { code: *b"EE", rev: 0 };
/// ET Ethiopia
pub const ETHIOPIA: Country = Country { code: *b"ET", rev: 0 };
/// FK Falkland_Islands_(Malvinas)
pub const FALKLAND_ISLANDS_MALVINAS: Country = Country { code: *b"FK", rev: 0 };
/// FO Faroe_Islands
pub const FAROE_ISLANDS: Country = Country { code: *b"FO", rev: 0 };
/// FJ Fiji
pub const FIJI: Country = Country { code: *b"FJ", rev: 0 };
/// FI Finland
pub const FINLAND: Country = Country { code: *b"FI", rev: 0 };
/// FR France
pub const FRANCE: Country = Country { code: *b"FR", rev: 0 };
/// GF French_Guina
pub const FRENCH_GUINA: Country = Country { code: *b"GF", rev: 0 };
/// PF French_Polynesia
pub const FRENCH_POLYNESIA: Country = Country { code: *b"PF", rev: 0 };
/// TF French_Southern_Territories
pub const FRENCH_SOUTHERN_TERRITORIES: Country = Country { code: *b"TF", rev: 0 };
/// GA Gabon
pub const GABON: Country = Country { code: *b"GA", rev: 0 };
/// GM Gambia
pub const GAMBIA: Country = Country { code: *b"GM", rev: 0 };
/// GE Georgia
pub const GEORGIA: Country = Country { code: *b"GE", rev: 0 };
/// DE Germany
pub const GERMANY: Country = Country { code: *b"DE", rev: 0 };
/// E0 European_Wide Revision 895
pub const EUROPEAN_WIDE_REV895: Country = Country { code: *b"E0", rev: 895 };
/// GH Ghana
pub const GHANA: Country = Country { code: *b"GH", rev: 0 };
/// GI Gibraltar
pub const GIBRALTAR: Country = Country { code: *b"GI", rev: 0 };
/// GR Greece
pub const GREECE: Country = Country { code: *b"GR", rev: 0 };
/// GD Grenada
pub const GRENADA: Country = Country { code: *b"GD", rev: 0 };
/// GP Guadeloupe
pub const GUADELOUPE: Country = Country { code: *b"GP", rev: 0 };
/// GU Guam
pub const GUAM: Country = Country { code: *b"GU", rev: 0 };
/// GT Guatemala
pub const GUATEMALA: Country = Country { code: *b"GT", rev: 0 };
/// GG Guernsey
pub const GUERNSEY: Country = Country { code: *b"GG", rev: 0 };
/// GN Guinea
pub const GUINEA: Country = Country { code: *b"GN", rev: 0 };
/// GW Guinea-bissau
pub const GUINEA_BISSAU: Country = Country { code: *b"GW", rev: 0 };
/// GY Guyana
pub const GUYANA: Country = Country { code: *b"GY", rev: 0 };
/// HT Haiti
pub const HAITI: Country = Country { code: *b"HT", rev: 0 };
/// VA Holy_See_(Vatican_City_State)
pub const HOLY_SEE_VATICAN_CITY_STATE: Country = Country { code: *b"VA", rev: 0 };
/// HN Honduras
pub const HONDURAS: Country = Country { code: *b"HN", rev: 0 };
/// HK Hong_Kong
pub const HONG_KONG: Country = Country { code: *b"HK", rev: 0 
```

### Core Architecture Module: `cyw43/src/events.rs`
```
#![allow(dead_code)]
#![allow(non_camel_case_types)]

use core::cell::RefCell;

use embassy_sync::blocking_mutex::raw::NoopRawMutex;
use embassy_sync::pubsub::{PubSubChannel, Subscriber};

use crate::structs::BssInfo;

crate::util::enum_from_u8! {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    #[cfg_attr(feature = "defmt", derive(defmt::Format))]
    enum Event {
        #[default]
        Unknown = 0xFF,
        /// indicates status of set SSID
        SET_SSID = 0,
        /// differentiates join IBSS from found (START) IBSS
        JOIN = 1,
        /// STA founded an IBSS or AP started a BSS
        START = 2,
        /// 802.11 AUTH request
        AUTH = 3,
        /// 802.11 AUTH indication
        AUTH_IND = 4,
        /// 802.11 DEAUTH request
        DEAUTH = 5,
        /// 802.11 DEAUTH indication
        DEAUTH_IND = 6,
        /// 802.11 ASSOC request
        ASSOC = 7,
        /// 802.11 ASSOC indication
        ASSOC_IND = 8,
        /// 802.11 REASSOC request
        REASSOC = 9,
        /// 802.11 REASSOC indication
        REASSOC_IND = 10,
        /// 802.11 DISASSOC request
        DISASSOC = 11,
        /// 802.11 DISASSOC indication
        DISASSOC_IND = 12,
        /// 802.11h Quiet period started
        QUIET_START = 13,
        /// 802.11h Quiet period ended
        QUIET_END = 14,
        /// BEACONS received/lost indication
        BEACON_RX = 15,
        /// generic link indication
        LINK = 16,
        /// TKIP MIC error occurred
        MIC_ERROR = 17,
        /// NDIS style link indication
        NDIS_LINK = 18,
        /// roam attempt occurred: indicate status & reason
        ROAM = 19,
        /// change in dot11FailedCount (txfail)
        TXFAIL = 20,
        /// WPA2 pmkid cache indication
        PMKID_CACHE = 21,
        /// current AP's TSF value went backward
        RETROGRADE_TSF = 22,
        /// AP was pruned from join list for reason
        PRUNE = 23,
        /// report AutoAuth table entry match for join attempt
        AUTOAUTH = 24,
        /// Event encapsulating an EAPOL message
        EAPOL_MSG = 25,
        /// Scan results are ready or scan was aborted
        SCAN_COMPLETE = 26,
        /// indicate to host addts fail/success
        ADDTS_IND = 27,
        /// indicate to host delts fail/success
        DELTS_IND = 28,
        /// indicate to host of beacon transmit
        BCNSENT_IND = 29,
        /// Send the received beacon up to the host
        BCNRX_MSG = 30,
        /// indicate to host loss of beacon
        BCNLOST_MSG = 31,
        /// before attempting to roam
        ROAM_PREP = 32,
        /// PFN network found event
        PFN_NET_FOUND = 33,
        /// PFN network lost event
        PFN_NET_LOST = 34,
        RESET_COMPLETE = 35,
        JOIN_START = 36,
        ROAM_START = 37,
        ASSOC_START = 38,
        IBSS_ASSOC = 39,
        RADIO = 40,
        /// PSM microcode watchdog fired
        PSM_WATCHDOG = 41,
        /// CCX association start
        CCX_ASSOC_START = 42,
        /// CCX association abort
        CCX_ASSOC_ABORT = 43,
        /// probe request received
        PROBREQ_MSG = 44,
        SCAN_CONFIRM_IND = 45,
        /// WPA Handshake
        PSK_SUP = 46,
        COUNTRY_CODE_CHANGED = 47,
        /// WMMAC excedded medium time
        EXCEEDED_MEDIUM_TIME = 48,
        /// WEP ICV error occurred
        ICV_ERROR = 49,
        /// Unsupported unicast encrypted frame
        UNICAST_DECODE_ERROR = 50,
        /// Unsupported multicast encrypted frame
        MULTICAST_DECODE_ERROR = 51,
        TRACE = 52,
        /// BT-AMP HCI event
        BTA_HCI_EVENT = 53,
        /// I/F change (for wlan host notification)
        IF = 54,
        /// P2P Discovery listen state expires
        P2P_DISC_LISTEN_COMPLETE = 55,
        /// indicate RSSI change based on configured levels
        RSSI = 56,
        /// PFN best network batching event
        PFN_BEST_BATCHING = 57,
        EXTLOG_MSG = 58,
        /// Action frame reception
        ACTION_FRAME = 59,
        /// Action frame Tx complete
        ACTION_FRAME_COMPLETE = 60,
        /// assoc request received
        PRE_ASSOC_IND = 61,
        /// re-assoc request received
        PRE_REASSOC_IND = 62,
        /// channel adopted (xxx: obsoleted)
        CHANNEL_ADOPTED = 63,
        /// AP started
        AP_STARTED = 64,
        /// AP stopped due to DFS
        DFS_AP_STOP = 65,
        /// AP resumed due to DFS
        DFS_AP_RESUME = 66,
        /// WAI stations event
        WAI_STA_EVENT = 67,
        /// event encapsulating an WAI message
        WAI_MSG = 68,
        /// escan result event
        ESCAN_RESULT = 69,
        /// action frame off channel complete
        ACTION_FRAME_OFF_CHAN_COMPLETE = 70,
        /// probe response received
        PROBRESP_MSG = 71,
        /// P2P Probe request received
        P2P_PROBREQ_MSG = 72,
        DCS_REQUEST = 73,
        /// credits for D11 FIFOs. [AC0,AC1,AC2,AC3,BC_MC,ATIM]
        FIFO_CREDIT_MAP = 74,
        /// Received action frame event WITH wl_event_rx_frame_data_t header
        ACTION_FRAME_RX = 75,
        /// Wake Event timer fired, used for wake WLAN test mode
        WAKE_EVENT = 76,
        /// Radio measurement complete
        RM_COMPLETE = 77,
        /// Synchronize TSF with the host
        HTSFSYNC = 78,
        /// request an overlay IOCTL/iovar from the host
        OVERLAY_REQ = 79,
        CSA_COMPLETE_IND = 80,
        /// excess PM Wake Event to inform host
        EXCESS_PM_WAKE_EVENT = 81,
        /// no PFN networks around
        PFN_SCAN_NONE = 82,
        /// last found PFN network gets lost
        PFN_SCAN_ALLGONE = 83,
        GTK_PLUMBED = 84,
        /// 802.11 ASSOC indication for NDIS only
        ASSOC_IND_NDIS = 85,
        /// 802.11 REASSOC indication for NDIS only
        REASSOC_IND_NDIS = 86,
        ASSOC_REQ_IE = 87,
        ASSOC_RESP_IE = 88,
        /// association recreated on resume
        ASSOC_RECREATED = 89,
        /// rx action frame event for NDIS only
        ACTION_FRAME_RX_NDIS = 90,
        /// authentication request received
        AUTH_REQ = 91,
        /// fast assoc recreation failed
        SPEEDY_RECREATE_FAIL = 93,
        /// port-specific event and payload (e.g. NDIS)
        NATIVE = 94,
        /// event for tx pkt delay suddently jump
        PKTDELAY_IND = 95,
        /// AWDL AW period starts
        AWDL_AW = 96,
        /// AWDL Master/Slave/NE master role event
        AWDL_ROLE = 97,
        /// Generic AWDL event
        AWDL_EVENT = 98,
        /// NIC AF txstatus
        NIC_AF_TXS = 99,
        /// NAN event
        NAN = 100,
        BEACON_FRAME_RX = 101,
        /// desired service found
        SERVICE_FOUND = 102,
        /// GAS fragment received
        GAS_FRAGMENT_RX = 103,
        /// GAS sessions all complete
        GAS_COMPLETE = 104,
        /// New device found by p2p offload
        P2PO_ADD_DEVICE = 105,
        /// device has been removed by p2p offload
        P2PO_DEL_DEVICE = 106,
        /// WNM event to notify STA enter sleep mode
        WNM_STA_SLEEP = 107,
        /// Indication of MAC tx failures (exhaustion of 802.11 retries) exceeding threshold(s)
        TXFAIL_THRESH = 108,
        /// Proximity Detection event
        PROXD = 109,
        /// AWDL RX Probe response
        AWDL_RX_PRB_RESP = 111,
        /// AWDL RX Action Frames
        AWDL_RX_ACT_FRAME = 112,
        /// AWDL Wowl nulls
        AWDL_WOWL_NULLPKT = 113,
        /// AWDL Phycal status
        AWDL_PHYCAL_STATUS = 114,
        /// AWDL OOB AF status
        AWDL_OOB_AF_STATUS = 115,
        /// Interleaved Scan status
        AWDL_SCAN_STATUS = 116,
        /// AWDL AW Start
        AWDL_AW_START = 117,
        /// AWDL AW End
        AWDL_AW_END = 118,
        /// AWDL AW Extensions
        AWDL_AW_EXT = 119,
        AWDL_PEER_CACHE_CONTROL = 120,
        CSA_START_IND = 121,
        CSA_DONE_IND = 122,
        CSA_FAILURE_IND = 123,
        //
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7137** (2026-09-29): **stm32/dma: move to folder and split ring buffers to new module**
  *Symptoms*: Makes DMA/BDMA module structure match GPDMA modules structure. It also improves readability by decreasing number of lines in `mod.rs`.  - I renamed `dma_bdma.rs` to `mod.rs` using `git mv` to preserve history.  - I split ring buffers by cutting and pasting to a new file and fixing imports without any other changes. I don't know if there is a better way that can preserve history.

- **Issue #7136** (2026-09-29): **stm32/spi: Add SPI slave example for STM32H723**
  *Symptoms*: Adds an SPI slave example for the STM32H723, based on an I2C example from this repository.  I had to change the default RAM section for the STM32H723 from DTCM (no DMA access) to AXISRAM (with DMA access). I tried to make it work with DTCM first and placed all read/write buffers into a different memory section, but I still got DMA errors afterwards.

- **Issue #7135** (2026-09-29): **stm32: document the `exti` feature**
  *Symptoms*: Closes #4710  Adds a doc comment to the `exti` feature in `embassy-stm32/Cargo.toml` so it shows up in the feature list on docs.embassy.dev.  The comment covers what the feature gates today:  - the `exti` module and `gpio::ExtiPin` - `Spi::new_slave`, `Spi::new_rxonly_slave` and `RingBufferedSpiRx`  I did not build the docs locally. Both `package.metadata.embassy_docs` and `package.metadata.docs.rs` already enable `exti`, so the `crate::exti` link resolves in those builds.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > 👋 Welcome, @12-Twelve-12, and thanks for opening your first pull request here!  If you haven't already, please give the [contributor guide](https://github.com/embassy-rs/embassy/blob/main/CONTRIBUTING.md) a read.

- **Issue #7134** (2026-09-29): **stm32: fix spi slave driver**
  *Symptoms*: cc @msrd0 

- **Issue #7133** (2026-09-29): **embassy-nrf: examples/nrf54l15/blinky throws a HardFault**
  *Symptoms*: How to reproduce:  1. Connect a nRF54L15-DK eval board 2. `git checkout 61faf6f911c0ad8e99f5ec972d7e1fa6a8302c4d` (current main) 3. `cd examples/nrf54l15-app` 4. `cargo run --release --bin blinky`  ``` 4905.233299 [INFO ] high! (blinky src/bin/blinky.rs:16) Firmware exited unexpectedly: Exception Core 0     Frame 0: HardFault_ @ 0x2dea         /home/jue/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/cortex-m-rt-0.7.7/src/lib.rs:1146:1     Frame 1: HardFault <Cause: Escalated BusFault (Precise data access error) at location: 0x48000008> @ 0x10ae     Frame 2: write_volatile<nrf_pac::inner::grtc::regs::Active> @ 0x10ae inline         /home/jue/.rustup/toolchains/1.92-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/core/src/ptr/mod.rs:2205:9     Frame 3: write_volatile<nrf_pac::inner::grtc::regs::Active> @ 0x10ae inline         /home/jue/.rustup/toolchains/1.92-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/core/src/ptr/mut_ptr.rs:1458:18     Frame 4: Reg<nrf_pac::inner::grtc::regs::Active, nrf_pac::inner::common::RW>::write_value @ 0x10ae inline         /home/jue/.cargo/git/checkouts/nrf-pac-5434cf7d907da92b/dcbec37/src/./chips/nrf54l15-app/pac.rs:3662:43     Frame 5: Reg<nrf_pac::inner::grtc::regs::Active, nrf_pac::inner::common::RW>::write<nrf_pac::inner::grtc::regs::Active, nrf_pac::inner::common::RW, embassy_nrf::time_driver::syscounter::{closure_env#0}> @ 0x10ae inline         /home/jue/.cargo/git/checkouts/nrf-pac-5434cf7d907da92b/dcbec37/src/./chips/nrf
  **Post-Mortem & Fix Analysis**:
  > Nevermind. Sry for the noise. I somehow failed at pulling the latest main and tested on main from April '26. Looks like it was late yesterday :D

- **Issue #7132** (2026-09-28): **stm32: update pac**
  *Symptoms*: add more g4 triggers

- **Issue #7131** (2026-09-28): **rp: usb host: do not set SIE_CTRL.SOF_SYNC for interrupt pipes**
  *Symptoms*: Interrupt endpoints are polled by the hardware and do not use SOF_SYNC. Setting it here left it on for good, so every later EPX transaction (bulk and control) waited for the next SOF: one packet per 1 ms frame, 64 KiB/s bulk on a full-speed link. Measured on an RP2350B with a full-speed hub, a low-speed keyboard behind it and a mass-storage stick: bulk reads 62 -> 744 KiB/s, control transfers ~10x faster, interrupt pipes unchanged.  Seems like you kinda knew this was weird :D

- **Issue #7130** (2026-09-28): **rp: usb host: re-arm the EPX yield once the transaction runs**
  *Symptoms*: A pipe that queues for EPX while another holds it arms STOP_EPX_ON_NAK so the holder gives EPX up at its next NAK. When EPX then goes to a pipe whose turn comes first, that pipe disarms the request as it takes EPX, before it starts its transaction. The queued pipe is not polled again, so nobody asks again: a holder whose endpoint only NAKs (a bulk IN that a class driver keeps pending, e.g. a CDC ECM data endpoint) keeps EPX until the queued transfer's own timeout fires.  Seen on an RP2350 with a mass storage stick and an ESP32-S3 (CDC ECM) behind a hub, each transfer in its own task: the stick's 1 KiB bulk IN transfers hit their 2 s timeout, and reads went from 21 s to 220-306 s per 64 KiB through the host driver.  Keeping the request armed at the hand-over is not enough: armed before START_TRANS it did not stop the new transaction (seen with both transfers in one task, which then hung). So after START_TRANS, arm the yield again if another pipe is queued.  With the fix: the same reads take 20.4-20.8 s per 64 KiB, as without the CDC device; one task reading the stick next to the pending bulk IN, in 1 KiB or 32 KiB transfers, runs at 440 KiB/s (683 KiB/s without it).

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `ba461aba` (2026-09-29)
**Commit Message**: stm32: fix spi slave driver

**File**: `embassy-stm32/src/spi/mod.rs` (modified, +80/-32)
```diff
@@ -315,6 +315,21 @@ impl<'d> CsPinType<'d> {
         }
     }
 
+    /// Returns true if the NSS pin is currently at its active (selected) level.
+    pub fn is_active(&self, polarity: SlaveSelectPolarity) -> bool {
+        let high = match self {
+            #[cfg(feature = "exti")]
+            Self::Exti(exti) => exti.is_high(),
+            Self::Flex(flex) => flex.is_high(),
+            Self::None => false,
+        };
+        match polarity {
+            #[cfg(any(spi_v4, spi_v5, spi_v6))]
+            SlaveSelectPolarity::ActiveHigh => high,
+            SlaveSelectPolarity::ActiveLow => !high,
+        }
+    }
+
     pub const fn is_none(&self) -> bool {
         matches!(self, Self::None)
     }
@@ -1561,16 +1576,22 @@ impl<'d> Spi<'d, Async, Slave> {
 
         let regs = self.info.regs;
 
-        // Cycle SPE (off, then on again once DMA is armed) for every transfer.
-        // Empirically on spi_v4+ a full-duplex slave transfer only works when the
-        // peripheral is restarted here: otherwise the RX DMA is never triggered
-        // (received frames pile up in the RX FIFO until the deselect, and the
-        // transfer returns garbage). The slave must also be armed while NSS is
-        // still deasserted: the transaction is captured from the NSS falling
-        // edge, which the EXTI wait then tracks for early deselect.
-        regs.cr1().modify(|w| {
-            w.set_spe(false);
-        });
+        // Cycle SPE (off, then on again once DMA is armed) for every transfer,
+        // unless the slave is already selected: restarting the peripheral while
+        // NSS is asserted latches an end-of-transaction and the slave then
+        // silently ignores the whole transaction (see `slave_abort` below).
+        // Empirically on spi_v4+ a restart is also required when not selected:
+        // otherwise the RX DMA is never triggered (received frames pile up in
+        // the RX FIFO until the deselect, and the transfer returns garbage).
+        // The slave must also be armed while NSS is still deasserted: the
+        // transaction is captured from the NSS falling edge, which the EXTI
+        // wait then tracks for early deselect.
+        let selected = self.nss.is_active(SlaveSelectPolarity::from_regs(regs));
+        if !selected {
+            regs.cr1().modify(|w| {
+                w.set_spe(false);
+            });
+        }
 
         self.set_word_size(W::CONFIG);
 
@@ -1658,13 +1679,20 @@ impl<'d> Spi<'d, Async, Slave> {
         for chunk in data.chunks_mut(u16::MAX as usize) {
             let regs = self.info.regs;
 
-            #[cfg(not(any(spi_v4, spi_v5, spi_v6)))]
-            regs.cr1().modify(|w| {
-                w.set_spe(false);
-            });
+            // Cycle SPE for every transfer, like `slave_transfer_inner`: on
+            // spi_v4+ the RX DMA is never triggered without the restart. Never
+            // restart while selected, though: the slave would ignore the
+            // ongoing transaction entirely.
+            let selected = self.nss.is_active(SlaveSelectPolarity::from_regs(regs));
+            if !selected {
+                regs.cr1().modify(|w| {
+                    w.set_spe(false);
+                });
+            }
 
             self.set_word_size(W::CONFIG);
 
+            // spi_v4 clears the rxfifo on SPE=0.
             #[cfg(not(any(spi_v4, spi_v5, spi_v6)))]
             flush_rx_fifo(regs);
 
@@ -1691,6 +1719,10 @@ impl<'d> Spi<'d, Async, Slave> {
             regs.cr1().modify(|w| {
                 w.set_spe(true);
             });
+            #[cfg(any(spi_v4, spi_v5, spi_v6))]
+            regs.cr1().modify(|w| {
+                w.set_cstart(true);
+            });
 
             let nss_fut = pin!(self.nss.wait_for_edge(SlaveSelectPolarity::from_regs(regs)));
             let mut deselect_count = None;
@@ -1749,14 +1781,21 @@ impl<'d> Spi<'d, Async, Slave> {
         for chunk in data.chunks(u16::MAX as usize) {
```

---

### Incident Patch 2: `21788cb4` (2026-09-28)
**Commit Message**: Merge pull request #7082 from embassy-rs/mspm0-nb-fix

mspm0/uart: nb read in BufferedUart should read from buffer, not from hardware.

**File**: `embassy-mspm0/CHANGELOG.md` (modified, +1/-0)
```diff
@@ -27,4 +27,5 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - feat: Move from GPIO waker arrays to maitake-sync wait map
 - fix: Flush the I2C controller FIFOs on the NACK/error paths, to prevent stale data
 - feat: Add inherent async `read`, `write`, `flush`, `fill_buf`, `consume` and `read_ready` methods to `BufferedUart`, `BufferedUartRx`, `BufferedUartTx`
+- fix: `embedded_hal_nb::serial::Read` for `BufferedUart`/`BufferedUartRx` reads from the RX buffer instead of the hardware FIFO
 - fix: `BufferedUart`/`BufferedUartTx` `flush` and `blocking_flush` wait until the last byte has been transmitted, not just until the TX buffer is empty
```

**File**: `embassy-mspm0/src/uart/buffered.rs` (modified, +5/-4)
```diff
@@ -584,11 +584,12 @@ impl embedded_hal_nb::serial::Read for BufferedUart<'_> {
 
 impl embedded_hal_nb::serial::Read for BufferedUartRx<'_> {
     fn read(&mut self) -> nb::Result<u8, Self::Error> {
-        if self.info.regs.stat().read().rxfe() {
-            return Err(nb::Error::WouldBlock);
+        let mut buf = [0u8; 1];
+        match self.try_read(&mut buf) {
+            Poll::Ready(Ok(_)) => Ok(buf[0]),
+            Poll::Ready(Err(e)) => Err(nb::Error::Other(e)),
+            Poll::Pending => Err(nb::Error::WouldBlock),
         }
-
-        super::read_with_error(self.info.regs).map_err(nb::Error::Other)
     }
 }
 
```

---

### Incident Patch 3: `8e760591` (2026-09-28)
**Commit Message**: fixes stm32 fdcan timestamp source selection and implements event marker access and marked transmission

**File**: `embassy-stm32/CHANGELOG.md` (modified, +2/-0)
```diff
@@ -41,6 +41,8 @@ Crypto:
 
 CAN:
 - fix: stm32/can/fdcan: write `FilterType::Range` bounds in the correct order (`from`→SFID1/EFID1, `to`→SFID2/EFID2). The swapped order prevented normal multi-ID ranges from matching, breaking both accepting and rejecting range filters.
+- fix: stm32/fdcan: apply `FdCanConfig::timestamp_source`. It was ignored and the timestamp counter always ran from the kernel clock, and `TimestampPrescaler` wrote the prescaler value instead of `TCP = prescaler - 1`.
+- fix: stm32/fdcan: the TX buffer element kept only 7 of the 8 message marker bits.
 
 Ethernet:
 - fix: stm32/eth v2: place a memory barrier before handing a descriptor to the DMA, so the buffer address and the frame contents are visible to it first.
```

**File**: `embassy-stm32/src/can/fd/message_ram/txbuffer_element.rs` (modified, +1/-1)
```diff
@@ -284,7 +284,7 @@ impl<'a> MM_W<'a> {
     #[doc = r"Writes raw bits to the field"]
     #[inline(always)]
     pub unsafe fn bits(self, value: u8) -> &'a mut W {
-        self.w.bits[1] = (self.w.bits[1] & !(0x7F << 24)) | (((value as u32) & 0x7F) << 24);
+        self.w.bits[1] = (self.w.bits[1] & !(0xFF << 24)) | (((value as u32) & 0xFF) << 24);
         self.w
     }
 
```

**File**: `embassy-stm32/src/can/fd/peripheral.rs` (modified, +48/-16)
```diff
@@ -74,6 +74,15 @@ impl Registers {
     #[cfg(feature = "time")]
     pub fn calc_timestamp(&self, ns_per_timer_tick: u64, ts_val: u16) -> Timestamp {
         let now_embassy = embassy_time::Instant::now();
+        // With TIM3 driving both embassy-time and the FDCAN timestamp counter
+        // (`TimestampSource::FromTIM3`), `ts_val` is the low 16 bits of the tick
+        // count at start of frame, whatever the tick rate. The delta is unambiguous
+        // as long as fewer than 2^16 ticks pass between the frame and this call.
+        #[cfg(time_driver_tim3)]
+        if self.timestamp_source_is_tim3() {
+            let delta = (now_embassy.as_ticks() as u16).wrapping_sub(ts_val);
+            return now_embassy.saturating_sub(embassy_time::Duration::from_ticks(u64::from(delta)));
+        }
         if ns_per_timer_tick == 0 {
             return now_embassy;
         }
@@ -92,16 +101,42 @@ impl Registers {
         ts_val
     }
 
-    pub fn put_tx_frame(&self, bufidx: usize, header: &Header, buffer: &[u8]) {
+    #[cfg(time_driver_tim3)]
+    fn timestamp_source_is_tim3(&self) -> bool {
+        cfg_if! {
+            if #[cfg(can_fdcan_v2)] {
+                self.regs.tscc().read().tss() == 2
+            } else {
+                self.regs.tscc().read().tss() == stm32_metapac::can::vals::Tss::External
+            }
+        }
+    }
+
+    pub fn put_tx_frame(&self, bufidx: usize, header: &Header, buffer: &[u8], marker: Option<u8>) {
         let mailbox = self.tx_buffer_element(bufidx);
         mailbox.reset();
-        put_tx_header(mailbox, header);
+        put_tx_header(mailbox, header, marker);
         put_tx_data(mailbox, buffer);
 
         // Set <idx as Mailbox> as ready to transmit
         self.regs.txbar().modify(|w| w.set_ar(bufidx, true));
     }
 
+    /// Pops the oldest TX event: frame id, message marker and raw start-of-frame timestamp.
+    pub fn tx_event(&self) -> Option<(embedded_can::Id, u8, u16)> {
+        let status = self.regs.txefs().read();
+        if status.effl() == 0 {
+            return None;
+        }
+        let index = status.efgi();
+        let event = self.msg_ram_mut().transmit.efsa[index as usize].read();
+        let id = make_id(event.id().bits(), event.xtd().bits());
+        let marker = event.mm().bits();
+        let ts = event.txts().bits();
+        self.regs.txefa().write(|w| w.set_efai(index));
+        Some((id, marker, ts))
+    }
+
     fn reg_to_error(value: u8) -> Option<BusError> {
         match value {
             // 0b000 => None,
@@ -224,7 +259,11 @@ impl Registers {
         }
     }
 
-    pub fn write<F: embedded_can::Frame + CanHeader>(&self, frame: &F) -> nb::Result<Option<F>, Infallible> {
+    pub fn write<F: embedded_can::Frame + CanHeader>(
+        &self,
+        frame: &F,
+        marker: Option<u8>,
+    ) -> nb::Result<Option<F>, Infallible> {
         let (idx, pending_frame) = if self.tx_queue_is_full() {
             if self.tx_queue_mode() == TxBufferMode::Fifo {
                 // Does not make sense to cancel a pending frame when using FIFO
@@ -251,7 +290,7 @@ impl Registers {
             (idx, None)
         };
 
-        self.put_tx_frame(idx as usize, frame.header(), frame.data());
+        self.put_tx_frame(idx as usize, frame.header(), frame.data(), marker);
 
         Ok(pending_frame)
     }
@@ -366,13 +405,7 @@ impl Registers {
 
         self.configure_msg_ram();
 
-        // Enable timestamping
-        #[cfg(not(can_fdcan_v2))]
-        self.regs
-            .tscc()
-            .write(|w| w.set_tss(stm32_metapac::can::vals::Tss::Increment));
-        #[cfg(can_fdcan_v2)]
-        self.regs.tscc().write(|w| w.set_tss(0x01));
+        self.set_timestamp_counter_source(config.timestamp_source);
 
         // this isn't really documented in the reference manual
         // but corresponding txbtie bit has to be set for the TC (TxComplete) interrupt to fire
@@ -529,19 +562,18 @@ impl Registers {
 
     /// Con
```

**File**: `embassy-stm32/src/can/fdcan.rs` (modified, +67/-18)
```diff
@@ -60,14 +60,14 @@ impl<T: Instance> interrupt::typelevel::Handler<T::IT0Interrupt> for IT0Interrup
                 TxMode::ClassicBuffered(buf) => {
                     if !T::registers().tx_queue_is_full() {
                         if let Ok(frame) = buf.tx_receiver.try_receive() {
-                            _ = T::registers().write(&frame);
+                            _ = T::registers().write(&frame, None);
                         }
                     }
                 }
                 TxMode::FdBuffered(buf) => {
                     if !T::registers().tx_queue_is_full() {
                         if let Ok(frame) = buf.tx_receiver.try_receive() {
-                            _ = T::registers().write(&frame);
+                            _ = T::registers().write(&frame, None);
                         }
                     }
                 }
@@ -147,10 +147,14 @@ fn calc_ns_per_timer_tick(
     info: &'static Info,
     freq: crate::time::Hertz,
     mode: crate::can::fd::config::FrameTransmissionConfig,
+    timestamp_source: TimestampSource,
 ) -> u64 {
-    match mode {
+    match (timestamp_source, mode) {
+        // No counter, or TIM3 running at the embassy tick rate rather than the kernel clock:
+        // `calc_timestamp` either has nothing to scale or handles TIM3 itself.
+        (TimestampSource::None, _) | (TimestampSource::FromTIM3, _) => 0,
         // Use timestamp from Rx FIFO to adjust timestamp reported to user
-        crate::can::fd::config::FrameTransmissionConfig::ClassicCanOnly => {
+        (_, crate::can::fd::config::FrameTransmissionConfig::ClassicCanOnly) => {
             let prescale: u64 = ({ info.regs.regs.nbtp().read().nbrp() } + 1) as u64
                 * ({ info.regs.regs.tscc().read().tcp() } + 1) as u64;
             1_000_000_000_u64 / (freq.0 as u64 * prescale)
@@ -269,6 +273,7 @@ impl<'d> CanConfigurator<'d> {
             &self.info,
             self.properties.kernel_input_clock(),
             self.config.frame_transmit,
+            self.config.timestamp_source,
         );
         self.info.state.lock(|s| {
             let mut state = s.borrow_mut();
@@ -343,15 +348,15 @@ impl<'d> Can<'d> {
     /// can be replaced, this call asynchronously waits for a frame to be successfully
     /// transmitted, then tries again.
     pub async fn write(&mut self, frame: &Frame) -> Option<Frame> {
-        TxMode::write(&self.info, frame).await
+        TxMode::write(&self.info, frame, None).await
     }
 
     /// Blocking write frame.
     ///
     /// If the TX queue is full, this will wait until there is space.
     pub fn blocking_write(&mut self, frame: &Frame) -> Option<Frame> {
         loop {
-            match self.info.regs.write(frame) {
+            match self.info.regs.write(frame, None) {
                 Ok(dropped) => return dropped,
                 Err(nb::Error::WouldBlock) => continue,
                 Err(nb::Error::Other(_)) => unreachable!(), // Infallible
@@ -390,22 +395,42 @@ impl<'d> Can<'d> {
     /// can be replaced, this call asynchronously waits for a frame to be successfully
     /// transmitted, then tries again.
     pub async fn write_fd(&mut self, frame: &FdFrame) -> Option<FdFrame> {
-        TxMode::write_fd(&self.info, frame).await
+        TxMode::write_fd(&self.info, frame, None).await
     }
 
     /// Blocking write FD frame.
     ///
     /// If the TX queue is full, this will wait until there is space.
     pub fn blocking_write_fd(&mut self, frame: &FdFrame) -> Option<FdFrame> {
         loop {
-            match self.info.regs.write(frame) {
+            match self.info.regs.write(frame, None) {
                 Ok(dropped) => return dropped,
                 Err(nb::Error::WouldBlock) => continue,
                 Err(nb::Error::Other(_)) => unreachable!(), // Infallible
             }
         }
     }
 
+    /// Like [`Self::write`], but stores a TX event carrying `marker` once the frame
+    /// has been sent. Read it ba
```

---

### Incident Patch 4: `f9801df1` (2026-09-28)
**Commit Message**: Merge pull request #7096 from felipebalbi/mcxa/rtc-fixes

[MCXA] rtc: fix alarm timing on MCXA2 and register access on MCXA5

**File**: `embassy-mcxa/src/chips/mcxa5xx.rs` (modified, +4/-1)
```diff
@@ -10,7 +10,10 @@ pub fn init(cfg: crate::config::Config) -> Peripherals {
     #[allow(unused_mut)]
     let mut peripherals = Peripherals::take();
 
-    // crate::interrupt::RTC.set_priority(cfg.rtc_interrupt_priority);
+    // The MCXA5 vector is named RTC0; the MCXA2 one is RTC. This line was
+    // copied from chips/mcxa2xx.rs, did not compile as `RTC`, and was commented
+    // out rather than renamed, so rtc_interrupt_priority was silently ignored.
+    crate::interrupt::RTC0.set_priority(cfg.rtc_interrupt_priority);
     crate::interrupt::GPIO0.set_priority(cfg.gpio_interrupt_priority);
     crate::interrupt::GPIO1.set_priority(cfg.gpio_interrupt_priority);
     crate::interrupt::GPIO2.set_priority(cfg.gpio_interrupt_priority);
```

**File**: `embassy-mcxa/src/clocks/types.rs` (modified, +2/-1)
```diff
@@ -141,7 +141,8 @@ pub struct Clocks {
     /// `clk_32k_vsys` is one of two/three outputs of the `FRO16K` internal oscillator.
     ///
     /// Also referred to as `clk_32k[0]` in the datasheet, it feeds peripherals in
-    /// the system domain, such as the CMP and RTC.
+    /// the system domain, such as the CMP. Note that it does NOT feed the RTC,
+    /// which is a VBAT-domain peripheral and uses `clk_32k[2]`.
     #[cfg(all(feature = "mcxa5xx", not(feature = "rosc-32k-as-gpio")))]
     pub clk_32k_vsys: Option<Clock>,
 
```

**File**: `embassy-mcxa/src/rtc/mcxa2xx.rs` (modified, +25/-0)
```diff
@@ -301,9 +301,34 @@ impl<'a> Rtc<'a> {
     /// # Note
     ///
     /// The datetime is converted to Unix timestamp and written to the time seconds register.
+    /// The time counter is left running, so the time advances from the moment it is set.
     pub fn set_datetime(&self, datetime: DateTime) {
         let seconds = convert_datetime_to_seconds(&datetime);
+
+        // RM 31.3.2: "The time seconds register and time prescaler register can
+        // be written only when SR[TCE] is clear." Without this the writes below
+        // are silently discarded whenever the counter happens to be running.
+        self.stop();
+
+        // RM 31.3.2: "Always write to the prescaler register before writing to
+        // the seconds register, because the seconds register increments on the
+        // falling edge of bit 14 of the prescaler register." Zeroing the
+        // prescaler also guarantees a full second elapses before TSR first
+        // increments, instead of an arbitrary fraction left over from before.
+        self.info.regs().tpr().write(|w| w.0 = 0);
         self.info.regs().tsr().write(|w| w.0 = seconds);
+
+        // RM 31.3.2: "SR[TIF] is set on POR and software reset and is cleared by
+        // initializing the time seconds register", and the prescaler only
+        // increments while TIF and TOF are clear. The TSR write above cleared
+        // TIF, so the counter can now be enabled.
+        //
+        // Starting here is what makes timekeeping actually run: previously the
+        // only caller of start() was wait_for_alarm_unlocked(), so the counter
+        // stayed frozen at the value set here until an alarm was armed, and an
+        // alarm at "now + N" then fired N seconds after arming rather than N
+        // seconds after the time was set.
+        self.start();
     }
 
     /// Get the current date and time
```

**File**: `embassy-mcxa/src/rtc/mcxa5xx.rs` (modified, +122/-11)
```diff
@@ -345,13 +345,43 @@ impl Config {
     }
 }
 
+/// Value every RTC register reads back while the block is resynchronizing.
+///
+/// RM 38.3.1.2: "any read to the RTC register returns FFFEh as the code to
+/// indicate the clock domains are synchronizing". The block stays in that
+/// state for as long as the clock selected by CTRL[CLK_SEL] is not running,
+/// and register writes are rejected throughout -- including the write that
+/// would point CLK_SEL back at a live clock. It is therefore not
+/// self-clearing: once CLK_SEL is left selecting a stopped clock, only
+/// starting that clock or a VBAT power-on reset recovers the RTC.
+///
+/// Treating FFFEh as data is actively dangerous rather than merely wrong:
+/// ISR[ALM_IS] is bit 2, and bit 2 of FFFEh is set, so an alarm future would
+/// complete immediately instead of waiting.
+const DESYNCED: u16 = 0xfffe;
+
+/// Value a counter register reads back while its contents are changing.
+///
+/// RM 38.5.1.11: STATUS[INVAL_BIT] is asserted for one oscillator clock either
+/// side of the 1 Hz boundary, and "reading when STATUS[INVAL_BIT] is asserted
+/// returns 0xFFFF. No transfer error is asserted." Decoded naively that is
+/// hour=31, minute=63, second=63, month=15, dow=7.
+///
+/// This is a distinct sentinel from [`DESYNCED`]: FFFFh means the counters are
+/// mid-update and the read should simply be retried, whereas FFFEh means the
+/// block has no clock at all and retrying will never succeed.
+const INVALID: u16 = 0xffff;
+
 /// Errors exclusive to HW initialization
 #[derive(Debug, Copy, Clone, PartialEq, Eq)]
 #[cfg_attr(feature = "defmt", derive(defmt::Format))]
 #[non_exhaustive]
 pub enum SetupError {
     /// Clock configuration error.
     ClockSetup,
+    /// The RTC register block is not accessible: reads return the
+    /// synchronizing sentinel (RM 38.3.1.2) or a write did not take effect.
+    RegisterAccess,
 }
 
 /// Errors exclusive for datetime.
@@ -396,12 +426,18 @@ impl<'a> Rtc<'a> {
     ) -> Result<Self, SetupError> {
         let info = T::info();
 
-        // The RTC is NOT gated by the MRCC, but we DO need to make
-        // sure either the 16k clock or the 32k clock is active.
+        // The RTC is NOT gated by the MRCC, but the clock selected by
+        // CTRL[CLK_SEL] must actually be running: the register block stays in
+        // its resynchronizing state for as long as it is not (RM 38.3.1.2).
+        //
+        // The RTC sits in the VBAT domain, so it is fed by clk_16k[2] /
+        // osc32k[2] (RM p.81527), not the system-domain [0] outputs. Measured
+        // on FRDM-MCXA577 with CLK_SEL=0: the counter runs with FROCLKE=0b100
+        // alone, and stops with 0b001 or 0b010.
         let clocks = if config.clksel == ClkSel::Clk16384 {
-            with_clocks(|c| c.clk_16k_vsys.clone())
+            with_clocks(|c| c.clk_16k_vbat.clone())
         } else {
-            with_clocks(|c| c.clk_32k_vsys.clone())
+            with_clocks(|c| c.clk_32k_vbat.clone())
         };
 
         let clk = clocks.flatten().ok_or(SetupError::ClockSetup)?;
@@ -423,6 +459,13 @@ impl<'a> Rtc<'a> {
     }
 
     fn set_configuration(&mut self, config: &Config) -> Result<(), SetupError> {
+        // Refuse to touch a block we cannot read or write. Every write below
+        // would be silently discarded, and callers would then be handed FFFEh
+        // dressed up as register contents.
+        if self.info.regs().ctrl().read().0 == DESYNCED {
+            return Err(SetupError::RegisterAccess);
+        }
+
         self.disable_write_protect();
 
         self.info.regs().ctrl().modify(|w| w.set_swr(Swr::Asserted));
@@ -467,6 +510,15 @@ impl<'a> Rtc<'a> {
 
         self.enable_write_protect();
 
+        // Selecting a clock that is not running desynchronizes the block on the
+        // spot, so confirm CLK_SEL actually took the requested value. Check the
+        // sentinel first: bit 9 of FFFEh is set, so a failed write of
+ 
```

**File**: `examples/mcxa2xx/src/bin/rtc_alarm.rs` (modified, +10/-5)
```diff
@@ -31,8 +31,6 @@ async fn main(_spawner: Spawner) {
         second: 0,
     };
 
-    rtc.stop();
-
     defmt::info!("Time set to: 2025-10-15 14:30:00");
     rtc.set_datetime(now);
 
@@ -42,11 +40,18 @@ async fn main(_spawner: Spawner) {
     let mut alarm = now;
     alarm.second += 20;
 
-    defmt::info!("Alarm set for: 2025-10-15 14:30:20 (+20 seconds)");
-    defmt::info!("RTC started, waiting for alarm...");
+    // SR[TAF] is set when TSR equals TAR *and then increments* (RM 31.5.1.7),
+    // so the alarm lands as the clock ticks to 14:30:21, about 6 s from here.
+    defmt::info!("Alarm set for: 2025-10-15 14:30:20, waiting...");
 
     rtc.wait_for_alarm(alarm).await;
-    defmt::info!("*** ALARM TRIGGERED! ***");
+    let at = rtc.get_datetime();
+    defmt::info!(
+        "*** ALARM TRIGGERED at {=u8}:{=u8}:{=u8} ***",
+        at.hour,
+        at.minute,
+        at.second
+    );
 
     defmt::info!("Example complete - Test PASSED!");
 }
```

---

### Incident Patch 5: `ab1e2099` (2026-09-28)
**Commit Message**: Merge pull request #7064 from zhuyi2024/personal/zhuyi/i2cNakFix

[MCXA] fix I2C NACK recovery

**File**: `embassy-mcxa/src/dma.rs` (modified, +1/-1)
```diff
@@ -1506,7 +1506,7 @@ impl DmaChannel<'_> {
     /// 4. Unpend the channel's IRQ in the NVIC so a queued dispatch is
     ///    dropped on the floor instead of running redundantly after CS
     ///    exit.
-    pub(crate) fn stop(&mut self) {
+    pub(crate) fn stop(&self) {
         let t = self.tcd();
         let irq = self.channel.interrupt();
 
```

**File**: `embassy-mcxa/src/i2c/controller.rs` (modified, +87/-20)
```diff
@@ -508,6 +508,20 @@ impl<'d, M: Mode> I2c<'d, M> {
         self.is_tx_fifo_empty() || self.status().is_err()
     }
 
+    /// Checks whether a STOP completed or an error prevents it from completing.
+    ///
+    /// A NACK automatically schedules a STOP, so keep waiting for the stop
+    /// detect flag instead of returning as soon as the NACK flag is visible.
+    fn is_stop_complete_or_error(&self) -> bool {
+        let msr = self.info.regs().msr().read();
+
+        if msr.sdf() == MsrSdf::IntYes {
+            return true;
+        }
+
+        !matches!(self.parse_status(&msr), Ok(()) | Err(IOError::AddressNack))
+    }
+
     /// Checks whether the RX FIFO is empty.
     fn is_rx_fifo_empty(&self) -> bool {
         self.info.regs().mfsr().read().rxcount() == 0
@@ -516,12 +530,14 @@ impl<'d, M: Mode> I2c<'d, M> {
     /// Parses the controller status producing an
     /// appropriate `Result<(), Error>` variant.
     fn parse_status(&self, msr: &Msr) -> Result<(), IOError> {
-        if msr.ndf() == Ndf::IntYes {
-            Err(IOError::AddressNack)
-        } else if msr.alf() == Alf::IntYes {
+        if msr.alf() == Alf::IntYes {
             Err(IOError::ArbitrationLoss)
         } else if msr.fef() == MsrFef::IntYes {
             Err(IOError::FifoError)
+        } else if msr.pltf() == Pltf::IntYes {
+            Err(IOError::Other)
+        } else if msr.ndf() == Ndf::IntYes {
+            Err(IOError::AddressNack)
         } else {
             Ok(())
         }
@@ -533,8 +549,6 @@ impl<'d, M: Mode> I2c<'d, M> {
     /// Will also send a STOP command if the tx_fifo is empty.
     fn status_and_act(&self) -> Result<(), IOError> {
         let msr = self.info.regs().msr().read();
-        self.info.regs().msr().write(|w| *w = msr);
-
         let status = self.parse_status(&msr);
 
         if let Err(IOError::AddressNack) = status {
@@ -547,10 +561,32 @@ impl<'d, M: Mode> I2c<'d, M> {
             // If neither of those conditions is true, we will send a
             // STOP ourselves.
             if !self.info.regs().mcfgr1().read().autostop() && self.is_tx_fifo_empty() {
-                self.remediation();
+                self.send_cmd(Cmd::STOP, 0);
+            }
+
+            // Keep NDF asserted until STOP completes. Clearing NDF early can
+            // release the rejected command still held by the command engine,
+            // causing its data byte to become the address of the next packet.
+            while !self.is_stop_complete_or_error() {
+                core::hint::spin_loop();
             }
+
+            let recovery_status = self.info.regs().msr().read();
+            let recovery_result = match self.parse_status(&recovery_status) {
+                Ok(()) | Err(IOError::AddressNack) => status,
+                error => error,
+            };
+
+            self.reset_fifos();
+
+            // Clear NDF only after STOP has completed, or after a terminal
+            // error has released the bus, and queued commands are discarded.
+            self.info.regs().msr().write(|w| *w = recovery_status);
+
+            return recovery_result;
         }
 
+        self.info.regs().msr().write(|w| *w = msr);
         status
     }
 
@@ -616,8 +652,9 @@ impl<'d, M: Mode> I2c<'d, M> {
 
         self.send_cmd(Cmd::STOP, 0);
 
-        // Wait for TxFIFO to be drained
-        while !self.is_tx_fifo_empty_or_error() {}
+        // Wait until STOP is observed on the bus. FIFO empty only means the
+        // command was accepted by the controller, not that it completed.
+        while !self.is_stop_complete_or_error() {}
 
         self.status_and_act()
     }
@@ -795,6 +832,16 @@ where
         });
     }
 
+    fn enable_stop_ints(&self) {
+        self.info.regs().mier().write(|w| {
+            w.set_sdie(true);
+            w.set_ndie(true);
+            w.set_alie(true);
+            w.set_feie(true);
+            w.set_pltie(true);
+        });
+    }
+
     /// Schedule sending a ST
```

---

### Incident Patch 6: `2a2189dd` (2026-09-28)
**Commit Message**: Merge pull request #7120 from robamu/trace-docs-improvements

improvements for trace docs

**File**: `embassy-executor/Cargo.toml` (modified, +8/-8)
```diff
@@ -85,7 +85,7 @@ build = [
 [package.metadata.embassy_docs]
 src_base = "https://github.com/embassy-rs/embassy/blob/embassy-executor-v$VERSION/embassy-executor/src/"
 src_base_git = "https://github.com/embassy-rs/embassy/blob/$COMMIT/embassy-executor/src/"
-features = ["defmt", "scheduler-deadline", "scheduler-priority"]
+features = ["defmt", "scheduler-deadline", "scheduler-priority", "trace"]
 flavors = [
     { name = "std",             target = "x86_64-unknown-linux-gnu",     features = ["platform-std", "executor-thread"] },
     { name = "wasm",            target = "wasm32-unknown-unknown",       features = ["platform-wasm", "executor-thread"] },
@@ -97,7 +97,7 @@ flavors = [
 [package.metadata.docs.rs]
 default-target = "thumbv7em-none-eabi"
 targets = ["thumbv7em-none-eabi"]
-features = ["defmt", "platform-cortex-m", "executor-thread", "executor-interrupt", "scheduler-deadline", "scheduler-priority", "embassy-time-driver"]
+features = ["defmt", "platform-cortex-m", "executor-thread", "executor-interrupt", "scheduler-deadline", "scheduler-priority", "embassy-time-driver", "trace"]
 
 [dependencies]
 defmt = { version = "1.0.1", optional = true }
@@ -158,16 +158,16 @@ _platform = [] # some platform was picked
 ## STD platform. Enables running the executor on top of `std` threading primitives.
 platform-std = ["_platform"]
 ## Cortex-M platform. Uses `WFE`/`SEV` for the thread executor, NVIC interrupts for the interrupt executor.
-## 
+##
 ## - Only usable on **single-core chips**. (Exception: the thread executor might work if your chip has wired the "event" signal between the cores, so `SEV` on one core can break a `WFE` in the other)
 ## - Only usable on **bare-metal**. Do not use this if you want to run the executor inside an RTOS thread, you must use RTOS primitives to sleep/notify the thread instead.
-## - Only usable on **privileged mode**. 
+## - Only usable on **privileged mode**.
 platform-cortex-m = ["_platform", "dep:cortex-m"]
 ## AArch32 platform (Cortex-A/R and other ARMv7-A/R and ARMv8-A/R cores in 32-bit mode). Uses `WFE`/`SEV` for the thread executor, GICv1/GICv2 software-generated interrupts (SGI) for the interrupt executor.
-## 
+##
 ## - Only usable on **single-core chips**. (Exception: the thread executor might work if your chip has wired the "event" signal between the cores, so `SEV` on one core can break a `WFE` in the other)
 ## - Only usable on **bare-metal**. Do not use this if you want to run the executor inside an RTOS thread, you must use RTOS primitives to sleep/notify the thread instead.
-## - Only usable on **privileged mode**. 
+## - Only usable on **privileged mode**.
 platform-aarch32 = ["_platform", "dep:aarch32-cpu", "dep:arm-targets"]
 ## RISC-V 32-bit platform. Uses WFI for the thread executor. Interrupt executor is not supported.
 ##
@@ -186,7 +186,7 @@ platform-wasm = ["_platform", "dep:wasm-bindgen", "dep:js-sys"]
 ## AVR platform. Uses WFI for the thread executor. Interrupt executor is not supported.
 platform-avr = ["_platform", "portable-atomic", "dep:avr-device"]
 ## Spin-loop platform.
-## 
+##
 ## This "platform" implementation is architecture/platform/chip agnostic. The main loop polls the executor constantly without sleeping, and the pender callback simply does nothing. Using this is not recommended, you probably want to use a platform-specific implementation that can sleep instead.
 platform-spin = ["_platform"]
 
@@ -204,7 +204,7 @@ metadata-name = ["embassy-executor-macros/metadata-name"]
 executor-thread = []
 ## Enable the interrupt-mode executor (available in Cortex-M only)
 executor-interrupt = []
-## Enable tracing hooks
+## Enable tracing hooks.
 trace = []
 
 ## Enable "Earliest Deadline First" Scheduler, using soft-realtime "deadlines" to prioritize
```

**File**: `embassy-executor/src/lib.rs` (modified, +9/-0)
```diff
@@ -4,6 +4,15 @@
 #![doc = include_str!("../README.md")]
 #![warn(missing_docs)]
 
+//! ## Tracing
+//!
+//! The `trace` feature enables hooks which report task and executor lifecycle events, for
+//! example to measure the run time of tasks.
+#![cfg_attr(
+    feature = "trace",
+    doc = "Implement [`raw::trace::Trace`] and register it with [`trace_impl!`]. See the [`raw::trace`] module for the lifecycles."
+)]
+
 //! ## Feature flags
 #![doc = document_features::document_features!(feature_label = r#"<span class="stab portability"><code>{feature}</code></span>"#)]
 
```

**File**: `embassy-executor/src/raw/trace.rs` (modified, +30/-30)
```diff
@@ -7,8 +7,8 @@
 //! ends, and is re-spawned, it MAY or MAY NOT have the same ID. While a task is active, the id will not change.
 //! For executors, the same applies, but the IDs will be stable for practical embedded programs.
 //!
-//! Callbacks can be used by enabling the `trace` feature, implementing the `Trace`
-//! trait, and registering the implementation with the `embassy_executor::trace_impl!` macro.
+//! Callbacks can be used by enabling the `trace` feature, implementing the [`Trace`]
+//! trait, and registering the implementation with the [`trace_impl!`](crate::trace_impl) macro.
 //! All callbacks must be implemented.
 //!
 //! ## Task Tracing lifecycle
@@ -32,16 +32,16 @@
 //!   └──────────────────────┘
 //! ```
 //!
-//! 1. A task is spawned, `task_new` is called
-//! 2. A task is enqueued for the first time, `task_ready_begin` is called
-//! 3. A task is polled, `task_exec_begin` is called
-//! 4. WHILE a task is polled, the task is re-awoken, and `task_ready_begin` is
+//! 1. A task is spawned, [`task_new`](Trace::task_new) is called
+//! 2. A task is enqueued for the first time, [`task_ready_begin`](Trace::task_ready_begin) is called
+//! 3. A task is polled, [`task_exec_begin`](Trace::task_exec_begin) is called
+//! 4. WHILE a task is polled, the task is re-awoken, and [`task_ready_begin`](Trace::task_ready_begin) is
 //!      called. The task does not IMMEDIATELY move state, until polling is complete and the
-//!      RUNNING state is existed. `task_exec_end` is called when polling is
+//!      RUNNING state is exited. [`task_exec_end`](Trace::task_exec_end) is called when polling is
 //!      complete, marking the transition to WAITING
-//! 5. Polling is complete, `task_exec_end` is called
-//! 6. The task has completed, and `task_end` is called
-//! 7. A task is awoken, `task_ready_begin` is called
+//! 5. Polling is complete, [`task_exec_end`](Trace::task_exec_end) is called
+//! 6. The task has completed, and [`task_end`](Trace::task_end) is called
+//! 7. A task is awoken, [`task_ready_begin`](Trace::task_ready_begin) is called
 //!
 //! ## Executor Tracing lifecycle
 //!
@@ -61,21 +61,21 @@
 //! ```
 //!
 //! 1. The executor is started (no associated trace)
-//! 2. A task on this executor is awoken. `task_ready_begin` is called
-//!      when this occurs, and `poll_start` is called when the executor
+//! 2. A task on this executor is awoken. [`task_ready_begin`](Trace::task_ready_begin) is called
+//!      when this occurs, and [`poll_start`](Trace::poll_start) is called when the executor
 //!      actually begins running
-//! 3. The executor has decided a task to poll. `task_exec_begin` is called
-//! 4. The executor finishes polling the task. `task_exec_end` is called
-//! 5. The executor has finished polling tasks. `executor_idle` is called
+//! 3. The executor has decided a task to poll. [`task_exec_begin`](Trace::task_exec_begin) is called
+//! 4. The executor finishes polling the task. [`task_exec_end`](Trace::task_exec_end) is called
+//! 5. The executor has finished polling tasks. [`executor_idle`](Trace::executor_idle) is called
 //!
 //! ## Idle
 //!
-//! `executor_idle` only means that a single executor has run out of work. With
+//! [`executor_idle`](Trace::executor_idle) only means that a single executor has run out of work. With
 //! multiple executors (e.g. a thread-mode executor plus one or more interrupt
 //! executors), an interrupt executor going idle returns to the preempted
 //! lower-priority context, which keeps running. The current thread/core is only
 //! idle when its thread-mode executor reaches its sleep site, at which point
-//! `idle` is called. In multi-core chips, or when using threads under std or an
+//! [`idle`](Trace::idle) is called. In multi-core chips, or when using threads under std or an
 //! RTOS, this does not mean the entire system is idle.
 
 use crate::ExecutorId;
@@ -85,45 +85,45 @@ unitrait::unitrait! {
     /// Executor trace hooks.
     ///
     /// Imp
```

---

### Incident Patch 7: `b2da6310` (2026-09-27)
**Commit Message**: improvements for trace docs

- Enable trace docs in built documentation
- Add more intra-links in trace docs

**File**: `embassy-executor/Cargo.toml` (modified, +8/-8)
```diff
@@ -85,7 +85,7 @@ build = [
 [package.metadata.embassy_docs]
 src_base = "https://github.com/embassy-rs/embassy/blob/embassy-executor-v$VERSION/embassy-executor/src/"
 src_base_git = "https://github.com/embassy-rs/embassy/blob/$COMMIT/embassy-executor/src/"
-features = ["defmt", "scheduler-deadline", "scheduler-priority"]
+features = ["defmt", "scheduler-deadline", "scheduler-priority", "trace"]
 flavors = [
     { name = "std",             target = "x86_64-unknown-linux-gnu",     features = ["platform-std", "executor-thread"] },
     { name = "wasm",            target = "wasm32-unknown-unknown",       features = ["platform-wasm", "executor-thread"] },
@@ -97,7 +97,7 @@ flavors = [
 [package.metadata.docs.rs]
 default-target = "thumbv7em-none-eabi"
 targets = ["thumbv7em-none-eabi"]
-features = ["defmt", "platform-cortex-m", "executor-thread", "executor-interrupt", "scheduler-deadline", "scheduler-priority", "embassy-time-driver"]
+features = ["defmt", "platform-cortex-m", "executor-thread", "executor-interrupt", "scheduler-deadline", "scheduler-priority", "embassy-time-driver", "trace"]
 
 [dependencies]
 defmt = { version = "1.0.1", optional = true }
@@ -158,16 +158,16 @@ _platform = [] # some platform was picked
 ## STD platform. Enables running the executor on top of `std` threading primitives.
 platform-std = ["_platform"]
 ## Cortex-M platform. Uses `WFE`/`SEV` for the thread executor, NVIC interrupts for the interrupt executor.
-## 
+##
 ## - Only usable on **single-core chips**. (Exception: the thread executor might work if your chip has wired the "event" signal between the cores, so `SEV` on one core can break a `WFE` in the other)
 ## - Only usable on **bare-metal**. Do not use this if you want to run the executor inside an RTOS thread, you must use RTOS primitives to sleep/notify the thread instead.
-## - Only usable on **privileged mode**. 
+## - Only usable on **privileged mode**.
 platform-cortex-m = ["_platform", "dep:cortex-m"]
 ## AArch32 platform (Cortex-A/R and other ARMv7-A/R and ARMv8-A/R cores in 32-bit mode). Uses `WFE`/`SEV` for the thread executor, GICv1/GICv2 software-generated interrupts (SGI) for the interrupt executor.
-## 
+##
 ## - Only usable on **single-core chips**. (Exception: the thread executor might work if your chip has wired the "event" signal between the cores, so `SEV` on one core can break a `WFE` in the other)
 ## - Only usable on **bare-metal**. Do not use this if you want to run the executor inside an RTOS thread, you must use RTOS primitives to sleep/notify the thread instead.
-## - Only usable on **privileged mode**. 
+## - Only usable on **privileged mode**.
 platform-aarch32 = ["_platform", "dep:aarch32-cpu", "dep:arm-targets"]
 ## RISC-V 32-bit platform. Uses WFI for the thread executor. Interrupt executor is not supported.
 ##
@@ -186,7 +186,7 @@ platform-wasm = ["_platform", "dep:wasm-bindgen", "dep:js-sys"]
 ## AVR platform. Uses WFI for the thread executor. Interrupt executor is not supported.
 platform-avr = ["_platform", "portable-atomic", "dep:avr-device"]
 ## Spin-loop platform.
-## 
+##
 ## This "platform" implementation is architecture/platform/chip agnostic. The main loop polls the executor constantly without sleeping, and the pender callback simply does nothing. Using this is not recommended, you probably want to use a platform-specific implementation that can sleep instead.
 platform-spin = ["_platform"]
 
@@ -204,7 +204,7 @@ metadata-name = ["embassy-executor-macros/metadata-name"]
 executor-thread = []
 ## Enable the interrupt-mode executor (available in Cortex-M only)
 executor-interrupt = []
-## Enable tracing hooks
+## Enable tracing hooks.
 trace = []
 
 ## Enable "Earliest Deadline First" Scheduler, using soft-realtime "deadlines" to prioritize
```

**File**: `embassy-executor/src/lib.rs` (modified, +9/-0)
```diff
@@ -4,6 +4,15 @@
 #![doc = include_str!("../README.md")]
 #![warn(missing_docs)]
 
+//! ## Tracing
+//!
+//! The `trace` feature enables hooks which report task and executor lifecycle events, for
+//! example to measure the run time of tasks.
+#![cfg_attr(
+    feature = "trace",
+    doc = "Implement [`raw::trace::Trace`] and register it with [`trace_impl!`]. See the [`raw::trace`] module for the lifecycles."
+)]
+
 //! ## Feature flags
 #![doc = document_features::document_features!(feature_label = r#"<span class="stab portability"><code>{feature}</code></span>"#)]
 
```

**File**: `embassy-executor/src/raw/trace.rs` (modified, +30/-30)
```diff
@@ -7,8 +7,8 @@
 //! ends, and is re-spawned, it MAY or MAY NOT have the same ID. While a task is active, the id will not change.
 //! For executors, the same applies, but the IDs will be stable for practical embedded programs.
 //!
-//! Callbacks can be used by enabling the `trace` feature, implementing the `Trace`
-//! trait, and registering the implementation with the `embassy_executor::trace_impl!` macro.
+//! Callbacks can be used by enabling the `trace` feature, implementing the [`Trace`]
+//! trait, and registering the implementation with the [`trace_impl!`](crate::trace_impl) macro.
 //! All callbacks must be implemented.
 //!
 //! ## Task Tracing lifecycle
@@ -32,16 +32,16 @@
 //!   └──────────────────────┘
 //! ```
 //!
-//! 1. A task is spawned, `task_new` is called
-//! 2. A task is enqueued for the first time, `task_ready_begin` is called
-//! 3. A task is polled, `task_exec_begin` is called
-//! 4. WHILE a task is polled, the task is re-awoken, and `task_ready_begin` is
+//! 1. A task is spawned, [`task_new`](Trace::task_new) is called
+//! 2. A task is enqueued for the first time, [`task_ready_begin`](Trace::task_ready_begin) is called
+//! 3. A task is polled, [`task_exec_begin`](Trace::task_exec_begin) is called
+//! 4. WHILE a task is polled, the task is re-awoken, and [`task_ready_begin`](Trace::task_ready_begin) is
 //!      called. The task does not IMMEDIATELY move state, until polling is complete and the
-//!      RUNNING state is existed. `task_exec_end` is called when polling is
+//!      RUNNING state is exited. [`task_exec_end`](Trace::task_exec_end) is called when polling is
 //!      complete, marking the transition to WAITING
-//! 5. Polling is complete, `task_exec_end` is called
-//! 6. The task has completed, and `task_end` is called
-//! 7. A task is awoken, `task_ready_begin` is called
+//! 5. Polling is complete, [`task_exec_end`](Trace::task_exec_end) is called
+//! 6. The task has completed, and [`task_end`](Trace::task_end) is called
+//! 7. A task is awoken, [`task_ready_begin`](Trace::task_ready_begin) is called
 //!
 //! ## Executor Tracing lifecycle
 //!
@@ -61,21 +61,21 @@
 //! ```
 //!
 //! 1. The executor is started (no associated trace)
-//! 2. A task on this executor is awoken. `task_ready_begin` is called
-//!      when this occurs, and `poll_start` is called when the executor
+//! 2. A task on this executor is awoken. [`task_ready_begin`](Trace::task_ready_begin) is called
+//!      when this occurs, and [`poll_start`](Trace::poll_start) is called when the executor
 //!      actually begins running
-//! 3. The executor has decided a task to poll. `task_exec_begin` is called
-//! 4. The executor finishes polling the task. `task_exec_end` is called
-//! 5. The executor has finished polling tasks. `executor_idle` is called
+//! 3. The executor has decided a task to poll. [`task_exec_begin`](Trace::task_exec_begin) is called
+//! 4. The executor finishes polling the task. [`task_exec_end`](Trace::task_exec_end) is called
+//! 5. The executor has finished polling tasks. [`executor_idle`](Trace::executor_idle) is called
 //!
 //! ## Idle
 //!
-//! `executor_idle` only means that a single executor has run out of work. With
+//! [`executor_idle`](Trace::executor_idle) only means that a single executor has run out of work. With
 //! multiple executors (e.g. a thread-mode executor plus one or more interrupt
 //! executors), an interrupt executor going idle returns to the preempted
 //! lower-priority context, which keeps running. The current thread/core is only
 //! idle when its thread-mode executor reaches its sleep site, at which point
-//! `idle` is called. In multi-core chips, or when using threads under std or an
+//! [`idle`](Trace::idle) is called. In multi-core chips, or when using threads under std or an
 //! RTOS, this does not mean the entire system is idle.
 
 use crate::ExecutorId;
@@ -85,45 +85,45 @@ unitrait::unitrait! {
     /// Executor trace hooks.
     ///
     /// Imp
```

---

### Incident Patch 8: `8ae6e7c4` (2026-09-26)
**Commit Message**: Merge pull request #7106 from cryptographix/cyw43-init-lockup-fix

fix(cyw43-pio): init() no longer hangs on 2nd call.

**File**: `cyw43-pio/src/lib.rs` (modified, +11/-0)
```diff
@@ -24,6 +24,7 @@ pub struct PioSpi<'d, PIO: Instance, const SM: usize> {
     dma_tx: Channel<'d, Async>,
     dma_rx: Channel<'d, Async>,
     wrap_target: u8,
+    pin_io: embassy_rp::pio::Pin<'d, PIO>,
 }
 
 /// Clock divider used for most applications
@@ -221,6 +222,7 @@ where
             dma_tx,
             dma_rx,
             wrap_target: loaded_program.wrap.target,
+            pin_io,
         }
     }
 
@@ -307,6 +309,15 @@ where
         status
     }
 
+    async fn prepare_reset(&mut self) {
+        // As per pico-sdk's cyw43_spi_gpio_setup(). Must hold data pin low across the
+        // WL_REG_ON pulse.
+        self.sm.set_enable(false);
+        self.sm.set_pin_dirs(Direction::Out, &[&self.pin_io]);
+        self.sm.set_pins(Level::Low, &[&self.pin_io]);
+        self.cs.set_high();
+    }
+
     async fn wait_for_event(&mut self) {
         self.irq.wait().await;
     }
```

**File**: `cyw43/src/runner.rs` (modified, +2/-1)
```diff
@@ -482,7 +482,8 @@ impl<'a, BUS: Bus, CHIP: Chip> Runner<'a, BUS, CHIP> {
         Ok(())
     }
 
-    pub(crate) async fn init(
+    /// Reset the bus, download firmware and nvram, and start the device core.
+    pub async fn init(
         &mut self,
         wifi_fw: &Aligned<A4, [u8]>,
         nvram: &Aligned<A4, [u8]>,
```

**File**: `cyw43/src/spi.rs` (modified, +24/-7)
```diff
@@ -2,12 +2,14 @@ use core::slice;
 
 use aligned::{A4, Aligned};
 use embassy_futures::yield_now;
-use embassy_time::Timer;
+use embassy_time::{Duration, Timer};
 use embedded_hal_1::digital::OutputPin;
 use futures::FutureExt;
 
+use crate::WithContext;
 use crate::consts::*;
 use crate::runner::{BusType, SealedBus};
+use crate::util::try_until;
 
 /// Custom Spi Trait that _only_ supports the bus operation of the cyw43
 /// Implementors are expected to hold the CS pin low during an operation.
@@ -23,6 +25,10 @@ pub trait SpiBusCyw43 {
     /// Callers that want to read `n` word from the backplane, have to provide a slice that is `n+1` words long.
     async fn cmd_read(&mut self, write: u32, read: &mut [u32]) -> u32;
 
+    /// Called immediately before the device is power-cycled, to setup bus/pins
+    /// to the correct state required during reset.
+    async fn prepare_reset(&mut self) {}
+
     /// Wait for events from the Device. A typical implementation would wait for the IRQ pin to be high.
     /// The default implementation always reports ready, resulting in active polling of the device.
     async fn wait_for_event(&mut self) {
@@ -169,20 +175,31 @@ where
             if left == right { Ok(()) } else { Err(()) }
         }
 
+        // Device loses both on reset. 0xAAAAAAAA never matches, forcing a full window write.
+        self.backplane_window = 0xAAAA_AAAA;
+        self.status = 0;
+
         // Reset
         trace!("WL_REG off/on");
+        self.spi.prepare_reset().await;
         self.pwr.set_low().unwrap();
         Timer::after_millis(20).await;
         self.pwr.set_high().unwrap();
         Timer::after_millis(250).await;
 
+        // Timeout so that an error cannot hang init() forever. See embassy-rs/embassy#6948.
         trace!("read REG_BUS_TEST_RO");
-        while self
-            .read32_swapped(FUNC_BUS, REG_BUS_TEST_RO)
-            .inspect(|v| trace!("{:#x}", v))
-            .await
-            != FEEDBEAD
-        {}
+        try_until(
+            async || {
+                self.read32_swapped(FUNC_BUS, REG_BUS_TEST_RO)
+                    .inspect(|v| trace!("{:#x}", v))
+                    .await
+                    == FEEDBEAD
+            },
+            Duration::from_millis(500),
+        )
+        .await
+        .ctx("Timeout waiting for bus test register")?;
 
         trace!("write REG_BUS_TEST_RW");
         self.write32_swapped(FUNC_BUS, REG_BUS_TEST_RW, TEST_PATTERN).await;
```

**File**: `tests/rp/src/bin/cyw43-perf.rs` (modified, +9/-1)
```diff
@@ -97,7 +97,15 @@ async fn main(spawner: Spawner) {
 
     static STATE: StaticCell<cyw43::State> = StaticCell::new();
     let state = STATE.init(cyw43::State::new());
-    let (net_device, mut control, runner) = cyw43::new(state, pwr, spi, fw, nvram).await;
+    let (net_device, mut control, mut runner) = cyw43::new(state, pwr, spi, fw, nvram).await;
+
+    // init must be repeatable: embassy-rs/embassy#6948
+    for i in 0..10 {
+        if runner.init(fw, nvram, None).await.is_err() {
+            panic!("re-init {} failed", i);
+        }
+    }
+
     spawner.spawn(unwrap!(wifi_task(runner)));
 
     control.init(clm).await;
```

---

### Incident Patch 9: `3fa82a26` (2026-09-16)
**Commit Message**: fix(rp): pend the TX interrupt when a buffered-uart writer parks

The PL011 transmit interrupt fires on a transition through the FIFO
trigger level, not on the level itself, so an already-empty FIFO never
raises it again. `write` handled that on its success path by pending the
interrupt by hand, but the two paths that park did not: `write` when the
ring is full and `flush` while the ring still holds bytes.

If the FIFO has drained to empty by then, nothing is left to move ring
into FIFO -- the task waits for a wake only the irq handler sends, and
the handler has nothing to run it. The writer parks until an unrelated
interrupt on the same peripheral happens to run the handler.

An async writer that flushes every frame, such as a CMUX multiplexer
over a modem UART, hits this regularly: measured stalls of up to 75s,
with the FIFO empty, CTS asserted and TXIM armed the whole time. With
this patch the same workload's longest write park was 296ms.

`write` now pends unconditionally, since a full ring needs the drain
kicked just as much as a successful push does and pending an
already-pending irq is a no-op. `flush` takes `info` to do the same.

**File**: `embassy-rp/src/uart/buffered.rs` (modified, +9/-5)
```diff
@@ -509,29 +509,33 @@ impl<'d> BufferedUartTx<'d> {
                 data[..n].copy_from_slice(&buf[..n]);
                 n
             });
+            // The TX interrupt only fires on a transition through the FIFO
+            // trigger level, so an empty FIFO never raises it again. Kick the
+            // drain by hand; a full ring needs it just as much as a short write.
+            info.interrupt.pend();
+
             if n == 0 {
                 return Poll::Pending;
             }
 
-            // The TX interrupt only triggers when the there was data in the
-            // FIFO and the number of bytes drops below a threshold. When the
-            // FIFO was empty we have to manually pend the interrupt to shovel
-            // TX data from the buffer into the FIFO.
-            info.interrupt.pend();
             Poll::Ready(Ok(n))
         })
         .await
     }
 
     /// Wait until all written bytes have been fully transmitted on the wire.
     pub async fn flush(&mut self) -> Result<(), Error> {
+        let info = self.info;
         let state = self.state;
         poll_fn(move |cx| {
             // Register before checking, for the same lost-wakeup window as in
             // `write` above.
             state.tx_waker.register(cx.waker());
 
             if !state.tx_buf.is_empty() {
+                // Same one-shot TX interrupt hazard as in `write`: bytes are
+                // still queued, so make sure something will shovel them out.
+                info.interrupt.pend();
                 return Poll::Pending;
             }
 
```

---

### Incident Patch 10: `f1fff55e` (2026-09-01)
**Commit Message**: fix(rp): register TX waker before checking buffered-uart state

The irq handler could drain the TX ring and wake between a failed push
and the waker registration; its final drain pops an empty ring and does
not wake again, parking the writer forever on an empty buffer with the
FIFO idle until an unrelated RX event re-polls the task. Mirrors the
register-before-check order already used on the read side. Same fix for
flush().

**File**: `embassy-rp/src/uart/buffered.rs` (modified, +13/-2)
```diff
@@ -494,14 +494,22 @@ impl<'d> BufferedUartTx<'d> {
                 return Poll::Ready(Ok(0));
             }
 
+            // Register before pushing, mirroring `read`. With the old
+            // push-then-register order the irq handler could drain the whole
+            // buffer and wake in the window between a failed push and the
+            // register; its final drain pops an empty buffer and does not wake
+            // again, so the writer parked forever on an empty buffer with the
+            // FIFO idle. Registering first closes the window: any drain after
+            // this wakes us for a re-poll.
+            state.tx_waker.register(cx.waker());
+
             let mut tx_writer = unsafe { state.tx_buf.writer() };
             let n = tx_writer.push(|data| {
                 let n = data.len().min(buf.len());
                 data[..n].copy_from_slice(&buf[..n]);
                 n
             });
             if n == 0 {
-                state.tx_waker.register(cx.waker());
                 return Poll::Pending;
             }
 
@@ -519,8 +527,11 @@ impl<'d> BufferedUartTx<'d> {
     pub async fn flush(&mut self) -> Result<(), Error> {
         let state = self.state;
         poll_fn(move |cx| {
+            // Register before checking, for the same lost-wakeup window as in
+            // `write` above.
+            state.tx_waker.register(cx.waker());
+
             if !state.tx_buf.is_empty() {
-                state.tx_waker.register(cx.waker());
                 return Poll::Pending;
             }
 
```

#### Recent Merged Pull Requests:
- **PR #7137** (2026-09-29): stm32/dma: move to folder and split ring buffers to new module (@pufmat)
- **PR #7136** (2026-09-29): stm32/spi: Add SPI slave example for STM32H723 (@msrd0)
- **PR #7135** (closed): stm32: document the `exti` feature (@12-Twelve-12)
- **PR #7134** (2026-09-29): stm32: fix spi slave driver (@xoviat)
- **PR #7132** (2026-09-28): stm32: update pac (@xoviat)
- **PR #7131** (2026-09-28): rp: usb host: do not set SIE_CTRL.SOF_SYNC for interrupt pipes (@maximevince)
- **PR #7130** (2026-09-28): rp: usb host: re-arm the EPX yield once the transaction runs (@maximevince)
- **PR #7129** (2026-09-29): rp: buffered uart: fill the TX FIFO across the ring's wrap (@maximevince)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
