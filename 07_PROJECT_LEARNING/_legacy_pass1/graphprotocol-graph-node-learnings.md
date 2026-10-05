# Forensic Learning Record (Deep Inspection): graphprotocol/graph-node

> **Canonical Artifact**: `07_PROJECT_LEARNING/graphprotocol-graph-node-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/graphprotocol/graph-node](https://github.com/graphprotocol/graph-node))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:42:02.090Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `graphprotocol/graph-node`
- **Description**: Graph Node indexes data from blockchains such as Ethereum and serves it over GraphQL
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 3151 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `chain/common/src/lib.rs`
```
use std::collections::HashMap;
use std::fmt::Debug;

use anyhow::Error;
use protobuf::Message;
use protobuf::UnknownValueRef;
use protobuf::descriptor::DescriptorProto;
use protobuf::descriptor::FieldDescriptorProto;
use protobuf::descriptor::OneofDescriptorProto;
use protobuf::descriptor::field_descriptor_proto::Label;
use protobuf::descriptor::field_descriptor_proto::Type;
use std::convert::From;
use std::path::Path;

const REQUIRED_ID: u32 = 77001;

#[derive(Debug, Clone)]
pub struct Field {
    pub name: String,
    pub type_name: String,
    pub required: bool,
    pub is_enum: bool,
    pub is_array: bool,
    pub fields: Vec<Field>,
}

#[derive(Debug, Clone)]
pub struct PType {
    pub name: String,
    pub fields: Vec<Field>,
    pub descriptor: DescriptorProto,
}

impl PType {
    pub fn fields(&self) -> Option<String> {
        let mut v = Vec::new();
        if let Some(vv) = self.req_fields_as_string() {
            v.push(vv);
        }
        if let Some(vv) = self.enum_fields_as_string() {
            v.push(vv);
        }

        if v.is_empty() {
            None
        } else {
            Some(v.join(","))
        }
    }

    pub fn has_req_fields(&self) -> bool {
        self.fields.iter().any(|f| f.required)
    }

    pub fn req_fields_as_string(&self) -> Option<String> {
        if self.has_req_fields() {
            Some(format!(
                "__required__{{{}}}",
                self.fields
                    .iter()
                    .filter(|f| f.required)
                    .map(|f| format!("{}: {}", f.name, f.type_name))
                    .collect::<Vec<String>>()
                    .join(",")
            ))
        } else {
            None
        }
    }

    pub fn has_enum(&self) -> bool {
        self.fields.iter().any(|f| f.is_enum)
    }

    pub fn enum_fields_as_string(&self) -> Option<String> {
        if !self.has_enum() {
            return None;
        }

        Some(
            self.fields
                .iter()
                .filter(|f| f.is_enum)
                .map(|f| {
                    let pairs = f
                        .fields
                        .iter()
                        .map(|f| format!("{}: {}", f.name, f.type_name))
                        .collect::<Vec<String>>()
                        .join(",");

                    format!("{}{{{}}}", f.name, pairs)
                })
                .collect::<Vec<String>>()
                .join(","),
        )
    }
}

impl From<&FieldDescriptorProto> for Field {
    fn from(fd: &FieldDescriptorProto) -> Self {
        let options = fd.options.unknown_fields();

        let type_name = if let Some(type_name) = fd.type_name.as_ref() {
            type_name.clone()
        } else if let Type::TYPE_BYTES = fd.type_() {
            "Vec<u8>".to_owned()
        } else {
            use heck::ToUpperCamelCase;
            fd.name().to_string().to_upper_camel_case()
        };

        Field {
            name: fd.name().to_owned(),
            type_name: type_name.rsplit('.').next().unwrap().to_owned(),
            required: options
                .iter()
                //(firehose.required) = true,  UnknownValueRef::Varint(0) => false, UnknownValueRef::Varint(1) => true
                .any(|f| f.0 == REQUIRED_ID && UnknownValueRef::Varint(1) == f.1),
            is_enum: false,
            is_array: Label::LABEL_REPEATED == fd.label(),
            fields: vec![],
        }
    }
}

impl From<&OneofDescriptorProto> for Field {
    fn from(fd: &OneofDescriptorProto) -> Self {
        Field {
            name: fd.name().to_owned(),
            type_name: "".to_owned(),
            required: false,
            is_enum: true,
            is_array: false,
            fields: vec![],
        }
    }
}

impl From<&DescriptorProto> for PType {
    fn from(dp: &DescriptorProto) -> Self {
        let mut fields = dp
            .oneof_decl
            .iter()
            .enumerate()
            .map(|(index, fd)| {
                let mut fld = Field::from(fd);

                fld.fields = dp
                    .field
                    .iter()
                    .filter(|fd| fd.oneof_index.is_some())
                    .filter(|fd| *fd.oneof_index.as_ref().unwrap() as usize == index)
                    .map(Field::from)
                    .collect::<Vec<Field>>();

                fld
            })
            .collect::<Vec<Field>>();

        fields.extend(
            dp.field
                .iter()
                .filter(|fd| fd.oneof_index.is_none())
                .map(Field::from)
                .collect::<Vec<Field>>(),
        );

        PType {
            name: dp.name().to_owned(),
            fields,
            descriptor: dp.clone(),
        }
    }
}

pub fn parse_proto_file<'a, P>(file_path: P) -> Result<HashMap<String, PType>, Error>
where
    P: 'a + AsRef<Path> + Debug,
{
    let dir = if let Some(p) = file_path.as_ref().parent() {
        p
    } else {
        return Err(anyhow::anyhow!(
            "Unable to derive parent path for {:?}",
            file_path
        ));
    };

    let fd = protobuf_parse::Parser::new()
        .include(dir)
        .input(&file_path)
        .file_descriptor_set()?;

    assert!(fd.file.len() == 1);
    assert!(fd.file[0].has_name());

    let file_name = file_path.as_ref().file_name().unwrap().to_str().unwrap();
    assert!(fd.file[0].name() == file_name);

    let ret_val = fd
        .file
        .iter() //should be just 1 file
        .flat_map(|f| f.message_type.iter())
        .map(|dp| (dp.name().to_owned(), PType::from(dp)))
        .collect::<HashMap<String, PType>>();

    Ok(ret_val)
}

```

### Core Architecture Module: `chain/ethereum/examples/firehose.rs`
```
use anyhow::Error;
use graph::{
    endpoint::EndpointMetrics,
    env::env_var,
    firehose::{self, FirehoseEndpoint, SubgraphLimit},
    log::logger,
    prelude::{MetricsRegistry, prost, tokio, tonic},
};
use graph_chain_ethereum::codec;
use hex::ToHex;
use prost::Message;
use std::slice;
use std::sync::Arc;
use tonic::Streaming;

#[tokio::main]
async fn main() -> Result<(), Error> {
    let mut cursor: Option<String> = None;
    let token_env = env_var("SF_API_TOKEN", "".to_string());
    let mut token: Option<String> = None;
    if !token_env.is_empty() {
        token = Some(token_env);
    }

    let logger = logger(false);
    let host = "https://api.streamingfast.io:443".to_string();
    let metrics = Arc::new(EndpointMetrics::new(
        logger,
        slice::from_ref(&host),
        Arc::new(MetricsRegistry::mock()),
    ));

    let firehose = Arc::new(FirehoseEndpoint::new(
        "firehose",
        &host,
        token,
        None,
        false,
        false,
        SubgraphLimit::Unlimited,
        metrics,
    ));

    loop {
        println!("Connecting to the stream!");
        let mut stream: Streaming<firehose::Response> = match firehose
            .clone()
            .stream_blocks(
                firehose::Request {
                    start_block_num: 12369739,
                    stop_block_num: 12369739,
                    cursor: match &cursor {
                        Some(c) => c.clone(),
                        None => String::from(""),
                    },
                    final_blocks_only: false,
                    ..Default::default()
                },
                &firehose::ConnectionHeaders::new(),
            )
            .await
        {
            Ok(s) => s,
            Err(e) => {
                println!("Could not connect to stream! {}", e);
                continue;
            }
        };

        loop {
            let resp = match stream.message().await {
                Ok(Some(t)) => t,
                Ok(None) => {
                    println!("Stream completed");
                    return Ok(());
                }
                Err(e) => {
                    println!("Error getting message {}", e);
                    break;
                }
            };

            let b = codec::Block::decode(resp.block.unwrap().value.as_ref());
            match b {
                Ok(b) => {
                    println!(
                        "Block #{} ({}) ({})",
                        b.number,
                        hex::encode(b.hash),
                        resp.step
                    );
                    b.transaction_traces.iter().for_each(|trx| {
                        let mut logs: Vec<String> = vec![];
                        trx.calls.iter().for_each(|call| {
                            call.logs.iter().for_each(|log| {
                                logs.push(format!(
                                    "Log {} Topics, Address {}, Trx Index {}, Block Index {}",
                                    log.topics.len(),
                                    log.address.encode_hex::<String>(),
                                    log.index,
                                    log.block_index
                                ));
                            })
                        });

                        if !logs.is_empty() {
                            println!("Transaction {}", trx.hash.encode_hex::<String>());
                            logs.iter().for_each(|log| println!("{}", log));
                        }
                    });

                    cursor = Some(resp.cursor)
                }
                Err(e) => panic!("Unable to decode {:?}", e),
            }
        }
    }
}

```

### Core Architecture Module: `chain/ethereum/src/adapter.rs`
```
use anyhow::Error;
use async_trait::async_trait;
use graph::abi;
use graph::blockchain::ChainIdentifier;
use graph::components::ethereum::AnyBlock;
use graph::components::subgraph::MappingError;
use graph::data::store::ethereum::call;
use graph::data_source::common::ContractCall;
use graph::firehose::CallToFilter;
use graph::firehose::CombinedFilter;
use graph::firehose::LogFilter;
use graph::prelude::alloy::primitives::keccak256;
use graph::prelude::alloy::primitives::{Address, B256};
use graph::prelude::alloy::rpc::types::Log;
use graph::prelude::alloy::transports::{RpcError, TransportErrorKind};
use itertools::Itertools;
use prost::Message;
use prost_types::Any;
use std::cmp;
use std::collections::{HashMap, HashSet};
use std::fmt;
use std::hash::Hash;
use thiserror::Error;

use graph::prelude::*;
use graph::{
    blockchain as bc,
    components::metrics::{CounterVec, GaugeVec, HistogramVec},
    petgraph::{self, graphmap::GraphMap},
};

use graph::blockchain::BlockPtr;

const COMBINED_FILTER_TYPE_URL: &str =
    "type.googleapis.com/sf.ethereum.transform.v1.CombinedFilter";

use crate::capabilities::NodeCapabilities;
use crate::data_source::{BlockHandlerFilter, DataSource};
use crate::{Chain, ENV_VARS, Mapping};

pub type EventSignature = B256;
pub type FunctionSelector = [u8; 4];

/// `EventSignatureWithTopics` is used to match events with
/// indexed arguments when they are defined in the subgraph
/// manifest.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct EventSignatureWithTopics {
    pub address: Option<Address>,
    pub signature: B256,
    pub topic1: Option<Vec<B256>>,
    pub topic2: Option<Vec<B256>>,
    pub topic3: Option<Vec<B256>>,
}

impl EventSignatureWithTopics {
    pub fn new(
        address: Option<Address>,
        signature: B256,
        topic1: Option<Vec<B256>>,
        topic2: Option<Vec<B256>>,
        topic3: Option<Vec<B256>>,
    ) -> Self {
        EventSignatureWithTopics {
            address,
            signature,
            topic1,
            topic2,
            topic3,
        }
    }

    /// Checks if an event matches the `EventSignatureWithTopics`
    /// If self.address is None, it's considered a wildcard match.
    /// Otherwise, it must match the provided address.
    /// It must also match the topics if they are Some
    pub fn matches(&self, address: Option<&Address>, sig: B256, topics: &[B256]) -> bool {
        // If self.address is None, it's considered a wildcard match. Otherwise, it must match the provided address.
        let address_matches = match self.address {
            Some(ref self_addr) => address == Some(self_addr),
            None => true, // self.address is None, so it matches any address.
        };

        address_matches
            && self.signature == sig
            && self
                .topic1
                .as_ref()
                .is_none_or(|t1| topics.get(1).is_some_and(|topic| t1.contains(topic)))
            && self
                .topic2
                .as_ref()
                .is_none_or(|t2| topics.get(2).is_some_and(|topic| t2.contains(topic)))
            && self
                .topic3
                .as_ref()
                .is_none_or(|t3| topics.get(3).is_some_and(|topic| t3.contains(topic)))
    }
}

#[derive(Error, Debug)]
pub enum EthereumRpcError {
    #[error("call error: {0}")]
    AlloyError(RpcError<TransportErrorKind>),
    #[error("ethereum node took too long to perform call")]
    Timeout,
}

#[derive(Error, Debug)]
pub enum ContractCallError {
    #[error("ABI error: {0:#}")]
    ABIError(anyhow::Error),
    #[error("type mismatch, decoded value {0:?} is not of kind {1:?}")]
    TypeError(abi::DynSolValue, abi::DynSolType),
    #[error("error encoding input call data: {0:#}")]
    EncodingError(anyhow::Error),
    #[error("call error: {0}")]
    AlloyError(RpcError<TransportErrorKind>),
    #[error("ethereum node took too long to perform call")]
    Timeout,
    #[error("internal error: {0}")]
    Internal(String),
}

impl From<ContractCallError> for MappingError {
    fn from(e: ContractCallError) -> Self {
        match e {
            // Any error reported by the Ethereum node could be due to the block no longer being on
            // the main chain. This is very unespecific but we don't want to risk failing a
            // subgraph due to a transient error such as a reorg.
            ContractCallError::AlloyError(e) => MappingError::PossibleReorg(anyhow::anyhow!(
                "Ethereum node returned an error for an eth_call: {e}"
            )),
            // Also retry on timeouts.
            ContractCallError::Timeout => MappingError::PossibleReorg(anyhow::anyhow!(
                "Ethereum node did not respond in time to eth_call"
            )),
            e => MappingError::Unknown(anyhow::anyhow!("Error when making an eth_call: {e}")),
        }
    }
}

#[derive(Copy, Clone, Debug, PartialEq, Eq, Ord, PartialOrd, Hash)]
enum LogFilterNode {
    Contract(Address),
    Event(EventSignature),
}

/// Corresponds to an `eth_getLogs` call.
#[derive(Clone, Debug)]
pub struct EthGetLogsFilter {
    pub contracts: Vec<Address>,
    pub event_signatures: Vec<B256>,
    pub topic1: Option<Vec<B256>>,
    pub topic2: Option<Vec<B256>>,
    pub topic3: Option<Vec<B256>>,
}

impl EthGetLogsFilter {
    /// Convert to alloy Filter for the given block range
    pub fn to_alloy_filter(&self, from: BlockNumber, to: BlockNumber) -> alloy::rpc::types::Filter {
        let mut filter_builder = alloy::rpc::types::Filter::new()
            .from_block(alloy::rpc::types::BlockNumberOrTag::Number(from as u64))
            .to_block(alloy::rpc::types::BlockNumberOrTag::Number(to as u64))
            .address(self.contracts.clone())
            .event_signature(self.event_signatures.clone());

        if let Some(ref topic1) = self.topic1 {
            filter_builder = filter_builder.topic1(topic1.clone());
        }
        if let Some(ref topic2) = self.topic2 {
            filter_builder = filter_builder.topic2(topic2.clone());
        }
        if let Some(ref topic3) = self.topic3 {
            filter_builder = filter_builder.topic3(topic3.clone());
        }

        filter_builder
    }

    fn from_contract(address: Address) -> Self {
        EthGetLogsFilter {
            contracts: vec![address],
            event_signatures: vec![],
            topic1: None,
            topic2: None,
            topic3: None,
        }
    }

    fn from_event(event: B256) -> Self {
        EthGetLogsFilter {
            contracts: vec![],
            event_signatures: vec![event],
            topic1: None,
            topic2: None,
            topic3: None,
        }
    }

    fn from_event_with_topics(event: EventSignatureWithTopics) -> Self {
        EthGetLogsFilter {
            contracts: event.address.map_or(vec![], |a| vec![a]),
            event_signatures: vec![event.signature],
            topic1: event.topic1,
            topic2: event.topic2,
            topic3: event.topic3,
        }
    }
}

impl fmt::Display for EthGetLogsFilter {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let base_msg = if self.contracts.len() == 1 {
            format!(
                "contract {:?}, {} events",
                self.contracts[0],
                self.event_signatures.len()
            )
        } else if self.event_signatures.len() == 1 {
            format!(
                "event {:?}, {} contracts",
                self.event_signatures[0],
                self.contracts.len()
            )
        } else {
            "unspecified filter".to_string()
        };

        // Helper to format topics as strings
        let format_topics = |topics: &Option<Vec<B256>>| -> String {
            topics.as_ref().map_or_else(
                || "None".to_string(),
                |ts| {
                    let signatures: Vec<String> = ts.iter().map(|t| format!("{:?}", t)).collect();
                    signatur
```

### Core Architecture Module: `chain/ethereum/src/buffered_call_cache.rs`
```
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use async_trait::async_trait;
use graph::{
    cheap_clone::CheapClone,
    components::store::EthereumCallCache,
    data::store::ethereum::call,
    prelude::{BlockPtr, CachedEthereumCall},
    slog::{Logger, error},
};

/// A wrapper around an Ethereum call cache that buffers call results in
/// memory for the duration of a block. If `get_call` or `set_call` are
/// called with a different block pointer than the one used in the previous
/// call, the buffer is cleared.
pub struct BufferedCallCache {
    call_cache: Arc<dyn EthereumCallCache>,
    buffer: Arc<Mutex<HashMap<call::Request, call::Retval>>>,
    block: Arc<Mutex<Option<BlockPtr>>>,
}

impl BufferedCallCache {
    pub fn new(call_cache: Arc<dyn EthereumCallCache>) -> Self {
        Self {
            call_cache,
            buffer: Arc::new(Mutex::new(HashMap::new())),
            block: Arc::new(Mutex::new(None)),
        }
    }

    fn check_block(&self, block: &BlockPtr) {
        let mut self_block = self.block.lock().unwrap();
        if self_block.as_ref() != Some(block) {
            *self_block = Some(block.clone());
            self.buffer.lock().unwrap().clear();
        }
    }

    fn get(&self, call: &call::Request) -> Option<call::Response> {
        let buffer = self.buffer.lock().unwrap();
        buffer.get(call).map(|retval| {
            call.cheap_clone()
                .response(retval.clone(), call::Source::Memory)
        })
    }
}

#[async_trait]
impl EthereumCallCache for BufferedCallCache {
    async fn get_call(
        &self,
        call: &call::Request,
        block: BlockPtr,
    ) -> Result<Option<call::Response>, graph::prelude::Error> {
        self.check_block(&block);

        if let Some(value) = self.get(call) {
            return Ok(Some(value));
        }

        let result = self.call_cache.get_call(call, block).await?;

        let mut buffer = self.buffer.lock().unwrap();
        if let Some(call::Response {
            retval,
            req: _,
            source: _,
        }) = &result
        {
            buffer.insert(call.cheap_clone(), retval.clone());
        }
        Ok(result)
    }

    async fn get_calls(
        &self,
        reqs: &[call::Request],
        block: BlockPtr,
    ) -> Result<(Vec<call::Response>, Vec<call::Request>), graph::prelude::Error> {
        self.check_block(&block);

        let mut missing = Vec::new();
        let mut resps = Vec::new();

        for call in reqs {
            match self.get(call) {
                Some(resp) => resps.push(resp),
                None => missing.push(call.cheap_clone()),
            }
        }

        let (stored, calls) = self.call_cache.get_calls(&missing, block).await?;

        {
            let mut buffer = self.buffer.lock().unwrap();
            for resp in &stored {
                buffer.insert(resp.req.cheap_clone(), resp.retval.clone());
            }
        }

        resps.extend(stored);
        Ok((resps, calls))
    }

    async fn get_calls_in_block(
        &self,
        block: BlockPtr,
    ) -> Result<Vec<CachedEthereumCall>, graph::prelude::Error> {
        self.call_cache.get_calls_in_block(block).await
    }

    async fn set_call(
        self: Arc<Self>,
        logger: &Logger,
        call: call::Request,
        block: BlockPtr,
        return_value: call::Retval,
    ) -> Result<(), graph::prelude::Error> {
        self.check_block(&block);

        // Enter the call into the in-memory cache immediately so that
        // handlers will find it, but add it to the underlying cache in the
        // background so we do not have to wait for that as it will be a
        // cache backed by the database
        {
            let mut buffer = self.buffer.lock().unwrap();
            buffer.insert(call.cheap_clone(), return_value.clone());
        }

        let cache = self.call_cache.cheap_clone();
        let logger = logger.cheap_clone();
        if let Err(e) = cache
            .set_call(&logger, call.cheap_clone(), block, return_value)
            .await
        {
            error!(logger, "BufferedCallCache: call cache set error";
                            "contract_address" => format!("{:?}", call.address),
                            "error" => e.to_string())
        }

        Ok(())
    }
}

```

### Core Architecture Module: `chain/ethereum/src/call_helper.rs`
```
use crate::{ContractCallError, ENV_VARS};
use graph::{
    abi,
    data::store::ethereum::call,
    prelude::{
        Logger,
        alloy::transports::{RpcError, TransportErrorKind},
        serde_json,
    },
    slog::info,
};

// ------------------------------------------------------------------
// Constants and helper utilities used across eth_call handling
// ------------------------------------------------------------------

// Try to check if the call was reverted. The JSON-RPC response for reverts is
// not standardized, so we have ad-hoc checks for each Ethereum client.

// 0xfe is the "designated bad instruction" of the EVM, and Solidity uses it for
// asserts.
const PARITY_BAD_INSTRUCTION_FE: &str = "Bad instruction fe";

// 0xfd is REVERT, but on some contracts, and only on older blocks,
// this happens. Makes sense to consider it a revert as well.
const PARITY_BAD_INSTRUCTION_FD: &str = "Bad instruction fd";

const PARITY_BAD_JUMP_PREFIX: &str = "Bad jump";
const PARITY_STACK_LIMIT_PREFIX: &str = "Out of stack";

// See f0af4ab0-6b7c-4b68-9141-5b79346a5f61.
const PARITY_OUT_OF_GAS: &str = "Out of gas";

// Also covers Nethermind reverts
const PARITY_VM_EXECUTION_ERROR: i64 = -32015;
const PARITY_REVERT_PREFIX: &str = "revert";

const XDAI_REVERT: &str = "revert";

// Deterministic RPC execution errors. We might need to expand this as
// subgraphs come across other errors. See
// https://github.com/ethereum/go-ethereum/blob/cd57d5cd38ef692de8fbedaa56598b4e9fbfbabc/core/vm/errors.go
const RPC_EXECUTION_ERRORS: &[&str] = &[
    // The "revert" substring covers a few known error messages, including:
    // Hardhat: "error: transaction reverted",
    // Ganache and Moonbeam: "vm exception while processing transaction: revert",
    // Geth: "execution reverted"
    // And others.
    "revert",
    "invalid jump destination",
    "invalid opcode",
    // Ethereum says 1024 is the stack sizes limit, so this is deterministic.
    "stack limit reached 1024",
    // See f0af4ab0-6b7c-4b68-9141-5b79346a5f61 for why the gas limit is considered deterministic.
    "out of gas",
    "stack underflow",
    "vm execution error",
    "invalidjump",
    "notactivated",
    "invalidfeopcode",
    // Reth surfaces EVM halts via `EvmHalt(HaltReason)`, formatted with the
    // reason's `Debug` repr (`"EVM error: {0:?}"`). revm's `HaltReason`
    // variants are CamelCase with no spaces, so e.g. a stack underflow arrives
    // as "EVM error: StackUnderflow", which the space-separated "stack
    // underflow" above does not match. "invalidjump"/"invalidfeopcode" already
    // cover the matching variants; these add the rest. Reth's OutOfGas is
    // handled before EvmHalt and rendered as "out of gas: ...", so it is
    // already covered above. See https://github.com/streamingfast/eth-go/pull/10.
    "stackunderflow",
    "stackoverflow",
    "opcodenotfound",
];

/// Helper that checks if a RPC error message corresponds to a revert.
fn is_rpc_revert_message(message: &str) -> bool {
    let env_rpc_call_errors = ENV_VARS.rpc_eth_call_errors.iter();
    let mut execution_errors = RPC_EXECUTION_ERRORS
        .iter()
        .copied()
        .chain(env_rpc_call_errors.map(|s| s.as_str()));
    execution_errors.any(|e| message.to_lowercase().contains(e))
}

/// Decode a Solidity revert(reason) payload, returning the reason string when possible.
fn as_solidity_revert_reason(bytes: &[u8]) -> Option<String> {
    let selector = &graph::prelude::alloy::primitives::keccak256(b"Error(string)")[..4];
    if bytes.len() >= 4 && &bytes[..4] == selector {
        abi::DynSolType::String
            .abi_decode(&bytes[4..])
            .ok()
            .and_then(|val| val.clone().as_str().map(ToOwned::to_owned))
    } else {
        None
    }
}

/// Interpret the error returned by `eth_call`, distinguishing genuine failures from
/// EVM reverts. Returns `Ok(Null)` for reverts or a proper error otherwise.
pub fn interpret_eth_call_error(
    logger: &Logger,
    err: RpcError<TransportErrorKind>,
) -> Result<call::Retval, ContractCallError> {
    fn reverted(logger: &Logger, reason: &str) -> Result<call::Retval, ContractCallError> {
        info!(logger, "Contract call reverted"; "reason" => reason);
        Ok(call::Retval::Null)
    }

    if let RpcError::ErrorResp(rpc_error) = &err
        && is_rpc_revert_message(&rpc_error.message)
    {
        return reverted(logger, &rpc_error.message);
    }

    if let RpcError::ErrorResp(rpc_error) = &err {
        let code = rpc_error.code;
        let data: Option<String> = rpc_error
            .data
            .as_ref()
            .and_then(|d| serde_json::from_str(d.get()).ok());

        if code == PARITY_VM_EXECUTION_ERROR
            && let Some(data) = data
            && is_parity_revert(&data)
        {
            return reverted(logger, &parity_revert_reason(&data));
        }
    }

    Err(ContractCallError::AlloyError(err))
}

fn is_parity_revert(data: &str) -> bool {
    data.to_lowercase().starts_with(PARITY_REVERT_PREFIX)
        || data.starts_with(PARITY_BAD_JUMP_PREFIX)
        || data.starts_with(PARITY_STACK_LIMIT_PREFIX)
        || data == PARITY_BAD_INSTRUCTION_FE
        || data == PARITY_BAD_INSTRUCTION_FD
        || data == PARITY_OUT_OF_GAS
        || data == XDAI_REVERT
}

/// Checks if the given data corresponds to a Parity / Nethermind style EVM
/// revert and, if so, tries to extract a human-readable revert reason. Returns `Some`
/// with the reason when the error is identified as a revert, otherwise `None`.
fn parity_revert_reason(data: &str) -> String {
    if data == PARITY_BAD_INSTRUCTION_FE {
        return PARITY_BAD_INSTRUCTION_FE.to_owned();
    }

    // Otherwise try to decode a Solidity revert reason payload.
    let payload = data.trim_start_matches(PARITY_REVERT_PREFIX);
    hex::decode(payload)
        .ok()
        .and_then(|decoded| as_solidity_revert_reason(&decoded))
        .unwrap_or_else(|| "no reason".to_owned())
}

```

### Core Architecture Module: `chain/ethereum/src/capabilities.rs`
```
use graph::impl_slog_value;
use std::cmp::Ordering;
use std::fmt;

use crate::DataSource;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct NodeCapabilities {
    pub archive: bool,
    pub traces: bool,
}

/// Two [`NodeCapabilities`] can only be compared if one is the subset of the
/// other. No [`Ord`] (i.e. total order) implementation is applicable.
impl PartialOrd for NodeCapabilities {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        product_order(&[
            self.archive.cmp(&other.archive),
            self.traces.cmp(&other.traces),
        ])
    }
}

/// Defines a [product order](https://en.wikipedia.org/wiki/Product_order) over
/// an array of [`Ordering`].
fn product_order(cmps: &[Ordering]) -> Option<Ordering> {
    if cmps.iter().all(|c| c.is_eq()) {
        Some(Ordering::Equal)
    } else if cmps.iter().all(|c| c.is_le()) {
        Some(Ordering::Less)
    } else if cmps.iter().all(|c| c.is_ge()) {
        Some(Ordering::Greater)
    } else {
        None
    }
}

impl fmt::Display for NodeCapabilities {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let NodeCapabilities { archive, traces } = self;

        let mut capabilities = vec![];
        if *archive {
            capabilities.push("archive");
        }
        if *traces {
            capabilities.push("traces");
        }

        f.write_str(&capabilities.join(", "))
    }
}

impl_slog_value!(NodeCapabilities, "{}");

impl graph::blockchain::NodeCapabilities<crate::Chain> for NodeCapabilities {
    fn from_data_sources(data_sources: &[DataSource]) -> Self {
        NodeCapabilities {
            archive: data_sources.iter().any(|ds| {
                ds.mapping
                    .requires_archive()
                    .expect("failed to parse mappings")
            }),
            traces: data_sources.iter().any(|ds| {
                ds.mapping.has_call_handler() || ds.mapping.has_block_handler_with_call_filter()
            }),
        }
    }
}

```

### Core Architecture Module: `chain/ethereum/src/chain.rs`
```
use anyhow::{Context, Error};
use anyhow::{Result, anyhow, bail};
use async_trait::async_trait;
use graph::blockchain::client::ChainClient;
use graph::blockchain::firehose_block_ingestor::{FirehoseBlockIngestor, Transforms};
use graph::blockchain::{
    BlockIngestor, BlockTime, BlockchainKind, ChainIdentifier, ExtendedBlockPtr,
    TriggerFilterWrapper, TriggersAdapterSelector,
};
use graph::components::network_provider::ChainName;
use graph::components::store::{DeploymentCursorTracker, SourceableStore};
use graph::data::subgraph::UnifiedMappingApiVersion;
use graph::firehose::{FirehoseEndpoint, FirehoseEndpoints, ForkStep};
use graph::futures03::TryStreamExt;
use graph::prelude::{
    BlockHash, ComponentLoggerConfig, ElasticComponentLoggerConfig, EthereumBlock,
    EthereumCallCache, LightEthereumBlock, LightEthereumBlockExt, MetricsRegistry, StoreError,
    retry,
};
use graph::slog::{debug, error, trace, warn};
use graph::{
    blockchain::{
        Block, BlockPtr, Blockchain, ChainHeadUpdateListener, IngestorError,
        RuntimeAdapter as RuntimeAdapterTrait, TriggerFilter as _,
        block_stream::{
            BlockRefetcher, BlockStreamEvent, BlockWithTriggers, FirehoseError,
            FirehoseMapper as FirehoseMapperTrait, TriggersAdapter as TriggersAdapterTrait,
        },
        firehose_block_stream::FirehoseBlockStream,
    },
    cheap_clone::CheapClone,
    components::store::DeploymentLocator,
    firehose,
    prelude::{
        BlockNumber, ChainStore, EthereumBlockWithCalls, Logger, LoggerFactory, o,
        serde_json as json,
    },
};
use prost::Message;
use std::collections::{BTreeSet, HashSet};
use std::future::Future;
use std::iter::FromIterator;
use std::sync::Arc;
use std::time::Duration;

use crate::codec::HeaderOnlyBlock;
use crate::data_source::DataSourceTemplate;
use crate::data_source::UnresolvedDataSourceTemplate;
use crate::ingestor::PollingBlockIngestor;
use crate::network::EthereumNetworkAdapters;
use crate::polling_block_stream::PollingBlockStream;
use crate::runtime::runtime_adapter::eth_call_gas;
use crate::{BufferedCallCache, NodeCapabilities};
use crate::{
    ENV_VARS, SubgraphEthRpcMetrics, TriggerFilter,
    adapter::EthereumAdapter as _,
    codec,
    data_source::{DataSource, UnresolvedDataSource},
    ethereum_adapter::{
        blocks_with_triggers, get_calls, parse_block_triggers, parse_call_triggers,
        parse_log_triggers,
    },
};
use crate::{EthereumAdapter, RuntimeAdapter};
use graph::blockchain::block_stream::{
    BlockStream, BlockStreamBuilder, BlockStreamError, BlockStreamMapper, FirehoseCursor,
    TriggersAdapterWrapper,
};
/// Celo Mainnet: 42220, Testnet Alfajores: 44787, Testnet Baklava: 62320
const CELO_CHAIN_IDS: [u64; 3] = [42220, 44787, 62320];

/// Resolved per-chain settings. Populated at chain initialisation from the config file (with
/// ENV_VAR fallbacks) and stored on [`Chain`] and [`crate::EthereumAdapter`].
#[derive(Clone, Debug)]
pub struct ChainSettings {
    pub polling_interval: Duration,
    pub json_rpc_timeout: Duration,
    pub request_retries: usize,
    pub max_block_range_size: BlockNumber,
    pub block_batch_size: usize,
    pub block_ptr_batch_size: usize,
    pub max_event_only_range: BlockNumber,
    pub target_triggers_per_block_range: u64,
    pub get_logs_max_contracts: usize,
    pub block_ingestor_max_concurrent_json_rpc_calls: usize,
    pub genesis_block_number: u64,
}

impl ChainSettings {
    /// Constructs a [`ChainSettings`] from environment variable defaults.
    /// Used in tests and for firehose-only chains that have no RPC config.
    pub fn from_env_defaults() -> Self {
        ChainSettings {
            polling_interval: graph::env::ENV_VARS.ingestor_polling_interval,
            json_rpc_timeout: ENV_VARS.json_rpc_timeout,
            request_retries: ENV_VARS.request_retries,
            max_block_range_size: ENV_VARS.max_block_range_size,
            block_batch_size: ENV_VARS.block_batch_size,
            block_ptr_batch_size: ENV_VARS.block_ptr_batch_size,
            max_event_only_range: ENV_VARS.max_event_only_range,
            target_triggers_per_block_range: ENV_VARS.target_triggers_per_block_range,
            get_logs_max_contracts: ENV_VARS.get_logs_max_contracts,
            block_ingestor_max_concurrent_json_rpc_calls: ENV_VARS
                .block_ingestor_max_concurrent_json_rpc_calls,
            genesis_block_number: ENV_VARS.genesis_block_number,
        }
    }
}

pub struct EthereumStreamBuilder {}

#[async_trait]
impl BlockStreamBuilder<Chain> for EthereumStreamBuilder {
    async fn build_firehose(
        &self,
        chain: &Chain,
        deployment: DeploymentLocator,
        block_cursor: FirehoseCursor,
        start_blocks: Vec<BlockNumber>,
        subgraph_current_block: Option<BlockPtr>,
        filter: Arc<<Chain as Blockchain>::TriggerFilter>,
        unified_api_version: UnifiedMappingApiVersion,
    ) -> Result<Box<dyn BlockStream<Chain>>> {
        let requirements = filter.node_capabilities();
        let adapter = chain
            .triggers_adapter(&deployment, &requirements, unified_api_version)
            .unwrap_or_else(|_| {
                panic!(
                    "no adapter for network {} with capabilities {}",
                    chain.name, requirements
                )
            });

        let logger = chain
            .logger_factory
            .subgraph_logger(&deployment)
            .new(o!("component" => "FirehoseBlockStream"));

        let firehose_mapper = Arc::new(FirehoseMapper { adapter, filter });

        Ok(Box::new(FirehoseBlockStream::new(
            deployment.hash,
            chain.chain_client(),
            subgraph_current_block,
            block_cursor,
            firehose_mapper,
            start_blocks,
            logger,
            chain.registry.clone(),
        )))
    }

    async fn build_subgraph_block_stream(
        &self,
        chain: &Chain,
        deployment: DeploymentLocator,
        start_blocks: Vec<BlockNumber>,
        source_subgraph_stores: Vec<Arc<dyn SourceableStore>>,
        subgraph_current_block: Option<BlockPtr>,
        filter: Arc<TriggerFilterWrapper<Chain>>,
        unified_api_version: UnifiedMappingApiVersion,
    ) -> Result<Box<dyn BlockStream<Chain>>> {
        self.build_polling(
            chain,
            deployment,
            start_blocks,
            source_subgraph_stores,
            subgraph_current_block,
            filter,
            unified_api_version,
        )
        .await
    }

    async fn build_polling(
        &self,
        chain: &Chain,
        deployment: DeploymentLocator,
        start_blocks: Vec<BlockNumber>,
        source_subgraph_stores: Vec<Arc<dyn SourceableStore>>,
        subgraph_current_block: Option<BlockPtr>,
        filter: Arc<TriggerFilterWrapper<Chain>>,
        unified_api_version: UnifiedMappingApiVersion,
    ) -> Result<Box<dyn BlockStream<Chain>>> {
        let requirements = filter.chain_filter.node_capabilities();
        let is_using_subgraph_composition = !source_subgraph_stores.is_empty();
        let adapter = TriggersAdapterWrapper::new(
            chain
                .triggers_adapter(&deployment, &requirements, unified_api_version.clone())
                .unwrap_or_else(|_| {
                    panic!(
                        "no adapter for network {} with capabilities {}",
                        chain.name, requirements
                    )
                }),
            source_subgraph_stores,
        );

        let logger = chain
            .logger_factory
            .subgraph_logger(&deployment)
            .new(o!("component" => "BlockStream"));
        let chain_head_update_stream = chain
            .chain_head_update_listener
            .subscribe(chain.name.to_string(), logger.clone());

        // Special case: Detect Celo and set the threshold to 0, so that eth_getLogs is always used.
        // This is 
```

### Core Architecture Module: `chain/ethereum/src/codec.rs`
```
#[rustfmt::skip]
#[allow(clippy::doc_lazy_continuation, clippy::doc_overindented_list_items)]
#[path = "protobuf/sf.ethereum.r#type.v2.rs"]
mod pbcodec;

use anyhow::format_err;
use graph::{
    blockchain::{
        self, Block as BlockchainBlock, BlockPtr, BlockTime, ChainStoreBlock, ChainStoreData,
    },
    components::ethereum::{
        AnyBlock, AnyHeader, AnyRpcHeader, AnyTransactionReceiptBare, AnyTxEnvelope,
    },
    prelude::{
        BlockNumber, Error, EthereumBlock, EthereumBlockWithCalls, EthereumCall,
        LightEthereumBlock,
        alloy::{
            self,
            consensus::{ReceiptWithBloom, TxEnvelope, TxType},
            network::AnyReceiptEnvelope,
            primitives::{Address, B256, Bloom, Bytes, LogData, U256, aliases::B2048},
            rpc::types::{self as alloy_rpc_types, AccessList, AccessListItem, Transaction},
        },
    },
};
use std::sync::Arc;
use std::{convert::TryFrom, fmt::Debug};

use crate::chain::BlockFinality;

pub use pbcodec::*;

trait TryDecodeProto<U, V>: Sized
where
    U: TryFrom<Self>,
    <U as TryFrom<Self>>::Error: Debug,
    V: From<U>,
{
    fn try_decode_proto(self, label: &'static str) -> Result<V, Error> {
        let u = U::try_from(self).map_err(|e| format_err!("invalid {}: {:?}", label, e))?;
        let v = V::from(u);
        Ok(v)
    }
}

impl TryDecodeProto<[u8; 32], B256> for &[u8] {}
impl TryDecodeProto<[u8; 256], B2048> for &[u8] {}
impl TryDecodeProto<[u8; 20], Address> for &[u8] {}

impl From<&BigInt> for U256 {
    fn from(val: &BigInt) -> Self {
        U256::from_be_slice(&val.bytes)
    }
}

pub struct CallAt<'a> {
    call: &'a Call,
    block: &'a Block,
    trace: &'a TransactionTrace,
}

impl<'a> CallAt<'a> {
    pub fn new(call: &'a Call, block: &'a Block, trace: &'a TransactionTrace) -> Self {
        Self { call, block, trace }
    }
}

impl<'a> TryInto<EthereumCall> for CallAt<'a> {
    type Error = Error;

    fn try_into(self) -> Result<EthereumCall, Self::Error> {
        Ok(EthereumCall {
            from: self.call.caller.try_decode_proto("call from address")?,
            to: self.call.address.try_decode_proto("call to address")?,
            value: self
                .call
                .value
                .as_ref()
                .map_or_else(|| U256::from(0), |v| v.into()),
            gas_used: self.call.gas_consumed,
            input: Bytes::from(self.call.input.clone()),
            output: Bytes::from(self.call.return_data.clone()),
            block_hash: self.block.hash.try_decode_proto("call block hash")?,
            block_number: self.block.number as i32,
            transaction_hash: Some(self.trace.hash.try_decode_proto("call transaction hash")?),
            transaction_index: self.trace.index as u64,
        })
    }
}

pub struct LogAt<'a> {
    log: &'a Log,
    block: &'a Block,
    trace: &'a TransactionTrace,
}

impl<'a> LogAt<'a> {
    pub fn new(log: &'a Log, block: &'a Block, trace: &'a TransactionTrace) -> Self {
        Self { log, block, trace }
    }
}

impl<'a> TryInto<alloy::rpc::types::Log> for LogAt<'a> {
    type Error = Error;

    fn try_into(self) -> Result<alloy::rpc::types::Log, Self::Error> {
        let topics = self
            .log
            .topics
            .iter()
            .map(|t| t.try_decode_proto("topic"))
            .collect::<Result<Vec<B256>, Error>>()?;

        Ok(alloy::rpc::types::Log {
            inner: alloy::primitives::Log {
                address: self.log.address.try_decode_proto("log address")?,
                data: LogData::new(topics, self.log.data.clone().into())
                    .ok_or_else(|| format_err!("invalid log data"))?,
            },
            block_hash: Some(self.block.hash.try_decode_proto("log block hash")?),
            block_number: Some(self.block.number),
            transaction_hash: Some(self.trace.hash.try_decode_proto("log transaction hash")?),
            transaction_index: Some(self.trace.index as u64),
            log_index: Some(self.log.block_index as u64),
            removed: false,
            block_timestamp: self
                .block
                .header
                .as_ref()
                .and_then(|h| h.timestamp.as_ref().map(|t| t.seconds as u64)),
        })
    }
}

pub struct TransactionTraceAt<'a> {
    trace: &'a TransactionTrace,
    block: &'a Block,
}

impl<'a> TransactionTraceAt<'a> {
    pub fn new(trace: &'a TransactionTrace, block: &'a Block) -> Self {
        Self { trace, block }
    }
}

impl<'a> TryInto<Transaction<AnyTxEnvelope>> for TransactionTraceAt<'a> {
    type Error = Error;

    fn try_into(self) -> Result<Transaction<AnyTxEnvelope>, Self::Error> {
        use alloy::{
            consensus::transaction::Recovered,
            consensus::{
                Signed, TxEip1559, TxEip2930, TxEip4844, TxEip4844Variant, TxEip7702, TxLegacy,
            },
            network::{AnyTxEnvelope, AnyTxType, UnknownTxEnvelope, UnknownTypedTransaction},
            primitives::{Bytes, TxKind, U256},
            rpc::types::Transaction as AlloyTransaction,
            serde::OtherFields,
        };
        use std::collections::BTreeMap;

        // Extract data from trace and block
        let block_hash = self.block.hash.try_decode_proto("transaction block hash")?;
        let block_number = self.block.number;
        let block_timestamp = self
            .block
            .header
            .as_ref()
            .and_then(|h| h.timestamp.as_ref().map(|t| t.seconds as u64));
        let transaction_index = Some(self.trace.index as u64);
        let from_address = self
            .trace
            .from
            .try_decode_proto("transaction from address")?;
        let to = get_to_address(self.trace)?;
        let value = self.trace.value.as_ref().map_or(U256::ZERO, |x| x.into());
        let gas_price = self.trace.gas_price.as_ref().map_or(0u128, |x| {
            let val: U256 = x.into();
            val.to::<u128>()
        });
        let gas_limit = self.trace.gas_limit;
        let input = Bytes::from(self.trace.input.clone());

        let tx_type_u64 = u64::try_from(self.trace.r#type).map_err(|_| {
            format_err!(
                "Invalid transaction type value {} in transaction trace. Transaction type must be a valid u64.",
                self.trace.r#type
            )
        })?;

        // Try to convert to known Ethereum transaction type
        let tx_type_result = TxType::try_from(tx_type_u64);

        // If this is an unknown transaction type, create an UnknownTxEnvelope
        if tx_type_result.is_err() {
            let mut fields_map = BTreeMap::new();

            fields_map.insert(
                "nonce".to_string(),
                jsonrpc_core::serde_json::json!(format!("0x{:x}", self.trace.nonce)),
            );
            fields_map.insert(
                "from".to_string(),
                jsonrpc_core::serde_json::json!(format!("{:?}", from_address)),
            );
            if let Some(to_addr) = to {
                fields_map.insert(
                    "to".to_string(),
                    jsonrpc_core::serde_json::json!(format!("{:?}", to_addr)),
                );
            }
            fields_map.insert(
                "value".to_string(),
                jsonrpc_core::serde_json::json!(format!("0x{:x}", value)),
            );
            fields_map.insert(
                "gas".to_string(),
                jsonrpc_core::serde_json::json!(format!("0x{:x}", gas_limit)),
            );
            fields_map.insert(
                "gasPrice".to_string(),
                jsonrpc_core::serde_json::json!(format!("0x{:x}", gas_price)),
            );
            fields_map.insert(
                "input".to_string(),
                jsonrpc_core::serde_json::json!(format!("0x{}", hex::encode(&input))),
            );

            let fields = OtherFields::new(fields_map);
            let unknown_tx = UnknownTypedTransaction {
      
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6609** (2026-06-26): **[Bug] Graphman dump/restore cant handle larger subgraphs**
  *Symptoms*: ### Bug report  So we are testing/working with graphman dump and restore. It works perfectly fine for smaller subgraphs, but on the larger ones it fails.  ### Relevant log output  ```Shell This is a known issue with arrow-array hitting a 2GB limit on byte array buffers. This typically happens when graphman (or graph-node) is trying to process a very large result set in one shot. What's causing it: Arrow's GenericBytesBuilder uses 32-bit offsets internally — once the accumulated byte data exceeds ~2GB, it overflows. This is a hard limit in the arrow-array crate when using i32 offsets (vs i64 for "large" variants). Likely triggers in your case: Running a graphman command that fetches a large dataset (entity counts, history, stats across many subgraphs/blocks) A subgraph with very large string fields or a huge number of entities being exported/queried at once Workarounds to try: Filter/limit the query — if the command accepts filters, scope it down (e.g. specific deployment hash, block range, or shard) ```  ### IPFS hash  _No response_  ### Subgraph name or link to explorer  _No response_  ### Some information to help us out  - [x] Tick this box if this bug is caused by a regression found in the latest release. - [ ] Tick this box if this bug is specific to the hosted service. - [x] I have searched the issue tracker to make sure this issue is not a duplicate.  ### OS information  Linux
  **Post-Mortem & Fix Analysis**:
  > if this is a trivial fix, please do lmk when a PR for it is open so we can try it (we want to move a large subgraph and test it)

- **Issue #6582** (2026-06-24): **[Bug] Handle Reth StackUnderflow as deterministic**
  *Symptoms*: ### Bug report  Add another check here: https://github.com/graphprotocol/graph-node/blob/ffc58a76d1f0c01f677a81c3c2f5adb8db407a49/chain/ethereum/src/call_helper.rs#L56  See PR on Firehose: https://github.com/streamingfast/eth-go/pull/10  ### Relevant log output  ```Shell  ```  ### IPFS hash  _No response_  ### Subgraph name or link to explorer  _No response_  ### Some information to help us out  - [ ] Tick this box if this bug is caused by a regression found in the latest release. - [ ] Tick this box if this bug is specific to the hosted service. - [x] I have searched the issue tracker to make sure this issue is not a duplicate.  ### OS information  None
  **Post-Mortem & Fix Analysis**:
  > wow opened a month ago and still nothing

- **Issue #6571** (2026-06-23): **[Bug] Graphnode can no longer process blocks with `base_fee_per_gas` over u64 limit**
  *Symptoms*: ### Bug report  When encountering a block with `base_fee_per_gas` being higher than 2^64, it fails to parse the block  In previous graphnode versions, the `base_fee_per_gas` field of the block header was U256  https://github.com/graphprotocol/rust-web3/blob/585c9db21576fd9aace40607b764ec870a5faebb/src/types/block.rs#L38-L39  In v0.42, graphnode switched to the alloy instead, which has the `base_fee_per_gas` as an u64  https://github.com/alloy-rs/alloy/blob/76aa416c661c370e588b9632d34d8e5062ab00f5/crates/consensus-any/src/block/header.rs#L60-L69  example block (Stable chain): ```json {   "baseFeePerGas": "0x3635c9adc5dea00000",   "blobGasUsed": "0x0",   "difficulty": "0x0",   "excessBlobGas": "0x0",   "extraData": "0x",   "gasLimit": "0x5f5e100",   "gasUsed": "0x0",   "hash": "0x4c2bdd9b606eaee018d298d05f5f87e515cda8a50de3a61707e0cafcc79d88a5",   "logsBloom": "0x000", // truncated for readability   "miner": "0x940d1df160e775dd10ae4d2a0e8f6b31b93e469d",   "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",   "nonce": "0x0000000000000000",   "number": "0x24f946",   "parentBeaconBlockRoot": "0x0000000000000000000000000000000000000000000000000000000000000000",   "parentHash": "0xb6e0b620c568296ad79c8f9c018916be70bc73dde41e88685d2a107e1fb46281",   "receiptsRoot": "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421",   "requestsHash": "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",   "sha3Uncles": "0x1dcc4de8dec75d7a
  **Post-Mortem & Fix Analysis**:
  > An Issue regarding this has been opened to Alloy by @incrypto32 https://github.com/alloy-rs/alloy/issues/3741 and it seems a fix has been merged https://github.com/alloy-rs/alloy/pull/3976
  > @dimitrovmaksim if that's the case please feel free to close the issue. Any timeline on release of the new version?
  > @LeonDolinar depends when alloy releases a new version with the fix. Will keep the issue open for visibility

- **Issue #6561** (2026-05-13): **"Found no transaction for event" on Base (OP Stack) — reproducible across deploys**
  *Symptoms*: ### Bug report  ## "Found no transaction for event" on Base (OP Stack) — reproducible across deploys  <img width="1728" height="1086" alt="Image" src="https://github.com/user-attachments/assets/381465f1-8cc9-4131-9dbb-6530b97acc39" />  ### Environment - **Subgraph Studio** (hosted) - **Network:** Base (chainId 8453) - **specVersion:** 1.2.0 - **apiVersion:** 0.0.9  ### Description  Deploying a Uniswap V4 subgraph on Base consistently fails with `Found no transaction for event` within ~77K blocks of startBlock. The same subgraph (identical schema + mappings) indexes successfully on **Ethereum** and **Arbitrum**.  ### Error (v0.0.1)  Error: failed to process trigger: block #25428006 (0x7d2ea361cee849c46ba41ab4f7dc3909342bbc78415e794a46979c14dc695ea9), transaction 9efd7044a2e5da263b970a55c859e2b7eee84f5c97be753f0c55d9bcca134510: Found no transaction for event   ### Error (v0.0.2 — after removing `receipt: true`)  Error: failed to process trigger: block #25427983 (0x5e09922a07f7c4e8a3df2781a7c47521652l030bd73eb1f1b20d8dcfd1a6l4c5), transaction b676b941fe70cca65b976256071a82ee03fa5e3011cae29111416f6c3f03d6b9: Found no transaction for event   ### Key observations  1. **Fails at different blocks on each deploy** — not a single corrupt block, appears systemic 2. **Transactions exist on-chain** — verified on [BaseScan](https://basescan.org/tx/0xb676b941fe70cca65b976256071a82ee03fa5e3011cae29111416f6c3f03d6b9): normal user swap through Uniswap V4, not an L1 deposit/system tx 3. **Remov
  **Post-Mortem & Fix Analysis**:
  > Can confirm. I get this type of error only for base chain subgraphs. Currently I have 8 subgraphs with this error. ```  failed to process trigger: block #38980095 (0x0a61d0221e6fd4108fd4421249902439d1a3b9350b5b15e6797b9c94f3e7f567), transaction   23c18709e935cb12b9c4d8c01e66b2c663d7c3128e6501b560593893c9ea4608: Found no transaction for event   failed to process trigger: block #38719205 (0x26f5b789b35f69af702fcfe77fc840cbb789e923de50f5fa025e0339c8d97c0f), transaction   4aab6beed5234f15e77329a6af417b425204d0efca454fc8f3a2826bdb9ba2c3: Found no transaction for event ```
  > @0xkaranchauhan do you use any load balancer rpc, or 3rd party providers or running local archive node?
  > This is an RPC provider issue. RPC provider is returning blocks with zero transactions in it. For subgraphs hosted by The Graph's upgrade indexer we have notified our provider about this. Closing this as its not a graph-node bug

- **Issue #6559** (2026-06-26): **[Bug] Heap corruption when host calls execute at AssemblyScript module-init time**
  *Symptoms*: ### Bug report  ### Summary  When a subgraph's AssemblyScript code invokes graph-ts host-call helpers (e.g. `Address.fromString`, `Bytes.fromHexString`) at module-initialization time via top-level `const` declarations, the graph-node wasm runtime ends up in a corrupted heap state. The corruption is silent until some unrelated handler later in the same `subgraph.yaml` reads an `AscString`, at which point graph-node throws: ``` Attempted to read past end of string content bytes chunk ``` (thrown from                                                                                                                                             [`runtime/wasm/src/asc_abi/v0_0_5.rs#L234`](https://github.com/graphprotocol/graph-node/blob/master/runtime/wasm/src/asc_abi/v0_0_5.rs#L234))               After retries this also surfaces as the related cascade error in `InputSchema::entity_type` with an empty/garbled name (`internal error: unknown name   when looking up entity type`), because subsequent host calls receive corrupted `AscString` pointers.                                                       ### Reproducer                                                                                                                                                                                                                    Minimal handler module:  ```typescript import { Address, Bytes } from "@graphprotocol/graph-ts" import { Pool } from "../generated/schema"                             
  **Post-Mortem & Fix Analysis**:
  > Hey @nkuba I believe this is the same issue as https://github.com/graphprotocol/graph-tooling/issues/2003 and has been addressed here https://github.com/graphprotocol/graph-tooling/pull/2006. Updating to graph-ts >= `0.38.1` should resolve it and compile the WASM correctly.
  > Closing, based on comment from @dimitrovmaksim. Please reopen if you still face the issue @nkuba 

- **Issue #6489** (2026-06-26): **[Bug] Graphnode can no longer parse traces with results missing `output` field**
  *Symptoms*: ### Bug report  When encountering a trace with callresult having missing `output` field, graphnode fails to parse it.  In previous graphnode versions, an `output` field of call trace result was specifically made optional (`#[serde(default)]`)  https://github.com/graphprotocol/rust-web3/blob/585c9db21576fd9aace40607b764ec870a5faebb/src/types/trace_filtering.rs#L158-L165  In v0.42, graphnode switched to the `alloy` instead, which has the `output` field as a non-optional, which causes this issue  https://github.com/alloy-rs/alloy/blob/76aa416c661c370e588b9632d34d8e5062ab00f5/crates/rpc-types-trace/src/parity.rs#L444-L450  example trace (sonic chain): ```json {   "action": {     "from": "0xf7cf0d9398d06d5cb7e4d37dc1e18a829bfff934",     "value": "0x0",     "gas": "0x0",     "init": "0x",     "address": "0xf7cf0d9398d06d5cb7e4d37dc1e18a829bfff934",     "refund_address": "0x4c3ccc98c01103be72bcfd29e1d2454c98d1a6e3",     "balance": "0x0"   },   "blockHash": "0x6b747793a61c3ce4e5f3355cf80edcb6aa465913ed43f4b0136d93803cf330f3",   "blockNumber": 66762070,   "result": {     "gasUsed": "0x0"   },   "subtraces": 0,   "traceAddress": [     1,     1   ],   "transactionHash": "0x5b3dc50c4c7bd9b0e80469b21febbc5d1b54b364a01b22b1e9c426e4632e0b8f",   "transactionPosition": 0,   "type": "suicide" } ```  ### Relevant log output  ```Shell Apr 07 09:43:20.816 WARN Trying again after trace_filter RPC call for block range: [66762070..66762070] failed (attempt #10) with result Err(deserialization error:
  **Post-Mortem & Fix Analysis**:
  > @isum have you had a chance to look at this?
  > This looks resolved on current `master` (v0.44.0) via the `alloy` upgrade.  In `alloy-rpc-types-trace` 2.0.5 (the pinned version), `TraceOutput` now has a custom `Deserialize` impl, and `CallOutput.output` carries `#[serde(default, deserialize_with = "alloy_serde::null_as_default")]`. A trace whose `result` is present but missing `output` (e.g. the `suicide` trace `result: {"gasUsed": "0x0"}` from this report) deserializes into `Call { output: <empty> }` instead of failing the whole batch.  Verified by deserializing the exact trace from this issue into `LocalizedTransactionTrace` against the pinned `alloy` — it now parses, and `graph-node` correctly ignores it as a non-CALL trace.  @Isarafanikov would you be able to confirm on a recent `graph-node` build? If it's no longer reproducing, this can be closed. 
  > Closing, Fixed as mentioned in above comment by @cargopete. @Isarafanikov  Feel free to reopen if you still encounter it.

- **Issue #6404** (2026-04-03): **[Bug] Null value resolved for non-null field `isDeprecated`**
  *Symptoms*: ### Bug report  I'm trying to make a query with introspection using python's gql.client ([fetch_schema_from_transport=True](https://gql.readthedocs.io/en/latest/modules/client.html)), but I returns an error because the intronspection queries don't respect the GraphQL schema.  This is the query being generated by gql.client: ```gql query IntrospectionQuery {   __schema {     queryType {       name     }     mutationType {       name     }     subscriptionType {       name     }     types {       ...FullType     }     directives {       name       description       locations       args(includeDeprecated: true) {         ...InputValue       }     }   } }  fragment FullType on __Type {   kind   name   description   fields(includeDeprecated: true) {     name     description     args(includeDeprecated: true) {       ...InputValue     }     type {       ...TypeRef     }     isDeprecated     deprecationReason   }   inputFields(includeDeprecated: true) {     ...InputValue   }   interfaces {     ...TypeRef   }   enumValues(includeDeprecated: true) {     name     description     isDeprecated     deprecationReason   }   possibleTypes {     ...TypeRef   } }  fragment InputValue on __InputValue {   name   description   type {     ...TypeRef   }   defaultValue   isDeprecated   deprecationReason }  fragment TypeRef on __Type {   kind   name   ofType {     kind     name     ofType {       kind       name       ofType {         kind         name         ofType {           kind           name  

- **Issue #6366** (2026-02-19): **graphman copy copies pruned earliest_block_number from source, resulting in invalid destination**
  *Symptoms*: ## Bug report  When using `graphman copy create` with a large offset on a pruned source, the destination deployment ends up with an `earliest_block_number` higher than its head block, resulting in an invalid/corrupted state.  ## Root cause  At the end of a copy operation, `copy_earliest_block()` (`store/postgres/src/deployment.rs:1336`) unconditionally copies the `earliest_block_number` from source to destination:  ```rust update(d::table.filter(d::id.eq(dst.id)))     .set(d::earliest_block_number.eq(sql(&query)))     .execute(conn)?; ```  This is called from `deployment_store.rs:1619`, after the copy is finalized.  When the source has been **pruned** (e.g. `earliest_block_number = 38545619`) and the copy uses a **large offset** that results in a destination head below that value (e.g. head at `35583707`), the destination inherits the source's pruned `earliest_block_number`.  ## Consequences  The destination deployment ends up in an inconsistent state: - `head = 35583707` - `earliest_block_number = 38545619` (from the pruned source)  This blocks `graphman rewind` with: ``` The block number 35522000 is not safe to rewind to for deployment QmXXX[6103]. The earliest block number of this deployment is 38545619. ```  ## Steps to reproduce  1. Have a subgraph `sgd2027` that has been pruned (`earliest_block_number` advanced to e.g. 38545619) 2. Run `graphman copy create` with a large offset, so the copy is taken at a block below the source's `earliest_block_number` 3. Observe that t
  **Post-Mortem & Fix Analysis**:
  > Hey @madumas is this a scenario that is expected to be used? If so, instead of restricting it maybe we should adjust the earliest_block logic to support it?
  > I've done that just a few days ago and stumbled upon it.  I'm using the offset logic to rewind a subgraph in a separate copy and keep the original one intact.  I'm not sure how changing earliest_block logic would help? My understanding is that if the subgraph is pruned the data is gone.
  > Yeah, i was thinking about something, but you're right, it won't work (at least not correctly) for pruned subgraphs.

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

### Incident Patch 1: `e1295f83` (2026-07-15)
**Commit Message**: gnd: Fix `add` and unify subgraph scaffolding generators (#6660)

* gnd: Unify subgraph scaffolding generators

Collapse the duplicated code generation so init and add share one path,
removing the forked add mapping generator that had drifted from the
scaffold one:

- a single sanitize_field_name in scaffold/naming.rs (three copies removed)
- a single generate_event_handlers driven by a new ResolvedEvent model
  (passthrough for now); add's copy is deleted
- shared SPEC_VERSION / MAPPING_API_VERSION constants and one to_kebab_case

No behavior change: init output is byte-identical and add is unchanged.

* gnd: Write schema entities and add guards in `add`

`gnd add` generated mappings and manifest entries that referenced entity
types it never declared, so codegen and build failed. Declare them, and
tighten two edges:

- append an entity type per new event to schema.graphql
- error when the data source name already exists
- only update networks.json when the file is present

* gnd: Resolve event-name collisions and merges in `add`

Decide each event's entity name once in a resolution pass, then feed the
schema, mapping and manifest generators from it:

- disambiguate events overload

**File**: `gnd/src/commands/add.rs` (modified, +309/-193)
```diff
@@ -3,19 +3,23 @@
 //! This command adds a new data source to an existing subgraph, generating
 //! the necessary manifest entries, schema types, and mapping stubs.
 
+use std::collections::HashSet;
 use std::fs;
 use std::path::{Path, PathBuf};
 
 use anyhow::{Context, Result, anyhow};
 use clap::Parser;
-use inflector::Inflector;
+use graphql_tools::parser::schema as gql;
 use serde_json::Value as JsonValue;
 
 use crate::config::networks::update_networks_file;
 use crate::formatter::format_typescript;
 use crate::output::{Step, step};
-use crate::scaffold::ScaffoldOptions;
 use crate::scaffold::manifest::{EventInfo, extract_events_from_abi};
+use crate::scaffold::{
+    MAPPING_API_VERSION, ResolvedEvent, ScaffoldOptions, disambiguate_events,
+    generate_event_entity, generate_event_handlers, to_kebab_case,
+};
 use crate::services::ContractService;
 
 #[derive(Clone, Debug, Parser)]
@@ -97,6 +101,14 @@ pub async fn run_add(opt: AddOpt) -> Result<()> {
     // Fetch or load ABI
     let (abi, contract_name, start_block) = get_contract_info(&opt, &network).await?;
 
+    // A data source / template name must be unique within the subgraph.
+    if existing_source_names(&manifest).contains(&contract_name) {
+        return Err(anyhow!(
+            "Data source or template named '{}' already exists. Choose a different name with --contract-name.",
+            contract_name
+        ));
+    }
+
     // Get project directory
     let project_dir = crate::manifest::manifest_dir(&opt.manifest);
 
@@ -111,14 +123,20 @@ pub async fn run_add(opt: AddOpt) -> Result<()> {
         index_events: true, // Always index events for add command
     };
 
-    // Extract events from ABI
+    // Extract events from the ABI and resolve their names against the entities
+    // already present in the subgraph (handles overloads and collisions). Both
+    // the manifest's entity lists and the types declared in schema.graphql count
+    // as existing, since either can be the source of a name collision.
     let events = extract_events_from_abi(&scaffold_options);
+    let mut existing = existing_entities(&manifest);
+    existing.extend(schema_entity_types(project_dir, &manifest));
+    let resolved = resolve_events(events, &existing, &contract_name, opt.merge_entities)?;
 
     // Add ABI file
     add_abi_file(project_dir, &contract_name, &abi)?;
 
     // Add mapping file
-    add_mapping_file(project_dir, &contract_name, &events)?;
+    add_mapping_file(project_dir, &contract_name, &resolved)?;
 
     // Update manifest
     update_manifest(
@@ -127,22 +145,27 @@ pub async fn run_add(opt: AddOpt) -> Result<()> {
         &contract_name,
         &network,
         start_block,
-        &events,
+        &resolved,
     )?;
 
-    // Update networks.json
+    // Declare the new event entities in the schema so codegen/build succeed.
+    add_schema_entities(project_dir, &manifest, &resolved)?;
+
+    // Update networks.json if the subgraph uses one.
     let networks_path = project_dir.join(&opt.network_file);
-    update_networks_file(
-        &networks_path,
-        &network,
-        &contract_name,
-        &opt.address,
-        start_block,
-    )?;
-    step(
-        Step::Write,
-        &format!("Updated {}", opt.network_file.display()),
-    );
+    if networks_path.exists() {
+        update_networks_file(
+            &networks_path,
+            &network,
+            &contract_name,
+            &opt.address,
+            start_block,
+        )?;
+        step(
+            Step::Write,
+            &format!("Updated {}", opt.network_file.display()),
+        );
+    }
 
     step(Step::Done, &format!("Added data source: {}", contract_name));
 
@@ -232,41 +255,16 @@ fn add_abi_file(project_dir: &Path, contract_name: &str, abi: &JsonValue) -> Res
     Ok(())
 }
 
-/// Sanitize a field name for GraphQL.
-fn sanitize_field_name(name: &str) -> String {
-    if name.is_empty() {
-        return "value".to_string();
-    }
-
-   
```

**File**: `gnd/src/scaffold/manifest.rs` (modified, +109/-20)
```diff
@@ -1,6 +1,9 @@
 //! Manifest (subgraph.yaml) generation for scaffold.
 
+use std::collections::HashMap;
+
 use super::ScaffoldOptions;
+use crate::shared::handle_reserved_word;
 
 /// Generate the subgraph.yaml manifest content.
 pub fn generate_manifest(options: &ScaffoldOptions) -> String {
@@ -21,11 +24,13 @@ pub fn generate_manifest(options: &ScaffoldOptions) -> String {
         source.push_str(&format!("      startBlock: {}\n", start_block));
     }
 
-    // Get event handlers from ABI
-    let event_handlers = get_event_handlers(options);
+    // Resolve events once (disambiguating overloaded names) so the handlers and
+    // entities lists stay consistent.
+    let events = disambiguate_events(extract_events_from_abi(options));
+    let event_handlers = get_event_handlers(contract_name, &events);
 
     format!(
-        r#"specVersion: 1.3.0
+        r#"specVersion: {spec_version}
 indexerHints:
   prune: auto
 schema:
@@ -37,7 +42,7 @@ dataSources:
     source:
 {source}    mapping:
       kind: ethereum/events
-      apiVersion: 0.0.9
+      apiVersion: {api_version}
       language: wasm/assemblyscript
       entities:{entities}
       abis:
@@ -46,15 +51,14 @@ dataSources:
       eventHandlers:{event_handlers}
       file: {mapping_file}
 "#,
-        entities = get_entities(options),
+        spec_version = super::SPEC_VERSION,
+        api_version = super::MAPPING_API_VERSION,
+        entities = get_entities(&events),
     )
 }
 
-/// Get event handlers from ABI.
-fn get_event_handlers(options: &ScaffoldOptions) -> String {
-    let contract_name = &options.contract_name;
-    let events = extract_events_from_abi(options);
-
+/// Get event handlers for the manifest.
+fn get_event_handlers(contract_name: &str, events: &[ResolvedEvent]) -> String {
     if events.is_empty() {
         // Default placeholder handler
         return format!(
@@ -66,40 +70,108 @@ fn get_event_handlers(options: &ScaffoldOptions) -> String {
 
     let mut handlers = String::new();
     for event in events {
-        let handler_name = format!("handle{}", event.name);
         handlers.push_str(&format!(
-            "\n        - event: {}\n          handler: {}",
-            event.signature, handler_name
+            "\n        - event: {}\n          handler: handle{}",
+            event.event.signature, event.alias
         ));
     }
 
     handlers
 }
 
-/// Get entities list for manifest.
-fn get_entities(options: &ScaffoldOptions) -> String {
-    let events = extract_events_from_abi(options);
-
+/// Get entities list for the manifest.
+fn get_entities(events: &[ResolvedEvent]) -> String {
     if events.is_empty() {
         return "\n        - ExampleEntity".to_string();
     }
 
-    // Always use event names from ABI, regardless of index_events
     let mut entities = String::new();
     for event in events {
-        entities.push_str(&format!("\n        - {}", event.name));
+        entities.push_str(&format!("\n        - {}", event.entity_name));
     }
     entities
 }
 
 /// Event info extracted from ABI.
-#[derive(Debug)]
+#[derive(Debug, Clone)]
 pub struct EventInfo {
     pub name: String,
     pub signature: String,
     pub inputs: Vec<EventInput>,
 }
 
+/// An event resolved to the concrete names the generators render.
+///
+/// Decided once (here / by collision resolution) so the schema, mapping and
+/// manifest generators never derive names independently:
+/// - `alias` names the handler function and the ABI event-type import; it is
+///   disambiguated for events overloaded within a single ABI.
+/// - `entity_name` names the GraphQL entity type, the `new` expression and the
+///   schema import; it gains a contract prefix when it collides with an entity
+///   that already exists in the subgraph.
+/// - `declare_in_schema` is false when the event reuses an entity that already
+///   exists (a merge), so the type must not be redeclared.
+#[derive(Debug, Clone)]
+pub struct ResolvedEvent {
+    pub event: 
```

**File**: `gnd/src/scaffold/mapping.rs` (modified, +77/-75)
```diff
@@ -1,7 +1,8 @@
 //! Mapping (AssemblyScript) generation for scaffold.
 
 use super::ScaffoldOptions;
-use super::manifest::{EventInfo, extract_events_from_abi};
+use super::manifest::{EventInfo, ResolvedEvent, extract_events_from_abi};
+use super::sanitize_field_name;
 
 /// Generate the mapping.ts content.
 pub fn generate_mapping(options: &ScaffoldOptions) -> String {
@@ -16,7 +17,8 @@ pub fn generate_mapping(options: &ScaffoldOptions) -> String {
         return generate_placeholder_mapping(contract_name, &events, options);
     }
 
-    generate_event_handlers(contract_name, &events, options)
+    let resolved = super::disambiguate_events(events);
+    generate_event_handlers(contract_name, &resolved)
 }
 
 /// Generate a fallback mapping when no events are found in ABI.
@@ -51,18 +53,20 @@ fn generate_placeholder_mapping(
     events: &[EventInfo],
     options: &ScaffoldOptions,
 ) -> String {
+    let resolved = super::disambiguate_events(events.to_vec());
+
     let mut output = String::new();
 
     // Import graph-ts types
     output.push_str("import {\n  BigInt,\n  Bytes\n} from \"@graphprotocol/graph-ts\"\n");
 
-    // Import contract class and all events
+    // Import contract class and all events (by disambiguated alias).
     output.push_str(&format!("import {{\n  {contract_name},\n"));
-    for (i, event) in events.iter().enumerate() {
-        let suffix = if i < events.len() - 1 { ",\n" } else { "\n" };
+    for (i, event) in resolved.iter().enumerate() {
+        let suffix = if i < resolved.len() - 1 { ",\n" } else { "\n" };
         output.push_str(&format!(
             "  {} as {}Event{}",
-            event.name, event.name, suffix
+            event.alias, event.alias, suffix
         ));
     }
     output.push_str(&format!(
@@ -73,18 +77,17 @@ fn generate_placeholder_mapping(
     output.push_str("import { ExampleEntity } from \"../generated/schema\"\n");
 
     // Generate first handler with full example code
-    let first_event = &events[0];
     output.push_str(&generate_first_placeholder_handler(
-        first_event,
+        &resolved[0],
         contract_name,
         options,
     ));
 
     // Generate empty stub handlers for remaining events
-    for event in events.iter().skip(1) {
+    for event in resolved.iter().skip(1) {
         output.push_str(&format!(
             "\nexport function handle{}(event: {}Event): void {{}}\n",
-            event.name, event.name
+            event.alias, event.alias
         ));
     }
 
@@ -93,19 +96,20 @@ fn generate_placeholder_mapping(
 
 /// Generate the first handler with full example code.
 fn generate_first_placeholder_handler(
-    event: &EventInfo,
+    event: &ResolvedEvent,
     contract_name: &str,
     options: &ScaffoldOptions,
 ) -> String {
-    let event_name = &event.name;
+    let event_name = &event.alias;
 
     // Generate field assignments for first 2 event params
     let mut field_assignments = String::new();
-    for input in event.inputs.iter().take(2) {
-        let field_name = sanitize_param_name(&input.name);
+    let accessors = super::event_param_accessors(&event.event.inputs);
+    for (input, accessor) in event.event.inputs.iter().zip(&accessors).take(2) {
+        let field_name = sanitize_field_name(&input.name);
         field_assignments.push_str(&format!(
             "  entity.{} = event.params.{}\n",
-            field_name, input.name
+            field_name, accessor
         ));
     }
 
@@ -153,22 +157,18 @@ export function handle{event_name}(event: {event_name}Event): void {{
     )
 }
 
-/// Generate event handlers for all events in the ABI.
-fn generate_event_handlers(
-    contract_name: &str,
-    events: &[super::manifest::EventInfo],
-    _options: &ScaffoldOptions,
-) -> String {
-    let mut imports = String::new();
-    let mut handlers = String::new();
+/// Generate event handlers for all resolved events.
+pub fn generate_event_handlers(contract_name: &str, events: &[ResolvedEvent]) -> St
```

**File**: `gnd/src/scaffold/mod.rs` (modified, +12/-3)
```diff
@@ -5,11 +5,16 @@
 
 pub mod manifest;
 mod mapping;
+mod naming;
 mod schema;
 
-pub use manifest::{EventInfo, EventInput, extract_events_from_abi, generate_manifest};
-pub use mapping::generate_mapping;
-pub use schema::generate_schema;
+pub use manifest::{
+    EventInfo, EventInput, ResolvedEvent, disambiguate_events, event_param_accessors,
+    extract_events_from_abi, generate_manifest,
+};
+pub use mapping::{generate_event_handlers, generate_mapping};
+pub(crate) use naming::sanitize_field_name;
+pub use schema::{generate_event_entity, generate_schema};
 
 use std::fs;
 use std::path::Path;
@@ -60,6 +65,10 @@ const GRAPH_CLI_VERSION: &str = "0.98.0";
 const GRAPH_TS_VERSION: &str = "0.37.0";
 const MATCHSTICK_VERSION: &str = "0.6.0";
 
+/// Manifest format versions emitted by the scaffolder.
+pub(crate) const SPEC_VERSION: &str = "1.3.0";
+pub(crate) const MAPPING_API_VERSION: &str = "0.0.9";
+
 /// Generate all scaffold files and write to directory.
 pub fn generate_scaffold(dir: &Path, options: &ScaffoldOptions) -> Result<()> {
     step(Step::Generate, "Generating scaffold files");
```

**File**: `gnd/src/scaffold/naming.rs` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+//! Shared name sanitization for scaffold code generation.
+//!
+//! A single source of truth for turning ABI parameter names into valid GraphQL
+//! field / AssemblyScript identifiers, used by both the schema and mapping
+//! generators so the two never disagree.
+
+/// Sanitize a parameter name into a valid GraphQL/AssemblyScript field identifier.
+pub(crate) fn sanitize_field_name(name: &str) -> String {
+    if name.is_empty() {
+        return "value".to_string();
+    }
+
+    // Identifiers must start with a letter or underscore; replace anything else.
+    let mut result = String::new();
+    for (i, c) in name.chars().enumerate() {
+        if i == 0 && c.is_ascii_digit() {
+            result.push('_');
+        }
+        if c.is_alphanumeric() || c == '_' {
+            result.push(c);
+        } else {
+            result.push('_');
+        }
+    }
+
+    // Convert a leading uppercase to camelCase.
+    if result
+        .chars()
+        .next()
+        .map(|c| c.is_uppercase())
+        .unwrap_or(false)
+    {
+        let mut chars = result.chars();
+        if let Some(first) = chars.next() {
+            result = first.to_lowercase().collect::<String>() + chars.as_str();
+        }
+    }
+
+    // Avoid clashing with the entity `id` field and the GraphQL `type` keyword.
+    let result = match result.as_str() {
+        "id" => "eventId".to_string(),
+        "type" => "eventType".to_string(),
+        _ => result,
+    };
+
+    // Escape reserved words via the shared list, so the entity field name
+    // matches the member the schema/ABI codegen generates from the same list.
+    crate::shared::handle_reserved_word(&result)
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn test_sanitize_field_name() {
+        // Normal names pass through.
+        assert_eq!(sanitize_field_name("owner"), "owner");
+        assert_eq!(sanitize_field_name("from"), "from");
+        // Empty -> placeholder.
+        assert_eq!(sanitize_field_name(""), "value");
+        // Leading uppercase -> camelCase.
+        assert_eq!(sanitize_field_name("Owner"), "owner");
+        assert_eq!(sanitize_field_name("TokenId"), "tokenId");
+        // Names that clash with the entity id / GraphQL keyword.
+        assert_eq!(sanitize_field_name("id"), "eventId");
+        assert_eq!(sanitize_field_name("type"), "eventType");
+        // Reserved words are suffixed so the generated code compiles. These use
+        // the shared list, so words only in it (for/default/null/void/instanceof)
+        // are covered too — and stay consistent with the schema/ABI codegen.
+        assert_eq!(sanitize_field_name("new"), "new_");
+        assert_eq!(sanitize_field_name("class"), "class_");
+        assert_eq!(sanitize_field_name("return"), "return_");
+        assert_eq!(sanitize_field_name("for"), "for_");
+        assert_eq!(sanitize_field_name("default"), "default_");
+        assert_eq!(sanitize_field_name("null"), "null_");
+        assert_eq!(sanitize_field_name("void"), "void_");
+        assert_eq!(sanitize_field_name("instanceof"), "instanceof_");
+        // Leading uppercase reserved word still resolves after camelCasing.
+        assert_eq!(sanitize_field_name("New"), "new_");
+        // Leading digit -> underscore prefix.
+        assert_eq!(sanitize_field_name("0value"), "_0value");
+        // Non-alphanumeric -> underscore.
+        assert_eq!(sanitize_field_name("a-b"), "a_b");
+    }
+}
```

---

### Incident Patch 2: `2e925ca6` (2026-06-30)
**Commit Message**: firehose: fix optimism check in extended blocks check

**File**: `graph/src/firehose/endpoints.rs` (modified, +6/-7)
```diff
@@ -89,13 +89,12 @@ impl NetworkDetails for Arc<FirehoseEndpoint> {
 
     async fn provides_extended_blocks(&self) -> anyhow::Result<bool> {
         let info = self.clone().info().await?;
-        let pred = if info.chain_name.contains("arbitrum-one")
-            || info.chain_name.contains("optimism-mainnet")
-        {
-            |x: &String| x.starts_with("extended") || x == "hybrid"
-        } else {
-            |x: &String| x == "extended"
-        };
+        let pred =
+            if info.chain_name.contains("arbitrum-one") || info.chain_name.contains("optimism") {
+                |x: &String| x.starts_with("extended") || x == "hybrid"
+            } else {
+                |x: &String| x == "extended"
+            };
 
         Ok(info.block_features.iter().any(pred))
     }
```

---

### Incident Patch 3: `e2f61cad` (2026-06-10)
**Commit Message**: ci: Fix Windows build and support publishing to an existing release (#6621)

* deps: Bump anstream to 0.6.21 to fix Windows build

anstream 0.6.14 declares `impl WinconStream for &'_ mut Buffer` on
Windows, which now conflicts with the blanket
`impl<T: WinconStream> WinconStream for &mut T` added in
anstyle-wincon 3.0.11. The collision breaks Windows builds with E0119.

Bumping to the semver-compatible 0.6.21 drops the explicit impl and
resolves the conflict.

* ci: Allow gnd-binary-build workflow to publish to an existing release

Adds a release_tag workflow_dispatch input. When set, the release,
publish-npm and publish-npm-wrapper jobs target the given tag instead
of github.ref_name, so a rebuilt artifact set can be attached to an
existing GitHub release and published to npm without cutting a new tag.

**File**: `.github/workflows/gnd-binary-build.yml` (modified, +12/-10)
```diff
@@ -3,6 +3,10 @@ name: Build gnd Binaries
 on:
   workflow_dispatch:
     inputs:
+      release_tag:
+        description: 'Existing release tag to upload binaries to and publish as on npm (e.g. v0.44.0). Leave empty to only build artifacts.'
+        type: string
+        default: ''
       dry_run:
         description: 'Dry-run npm publish (no actual publish)'
         type: boolean
@@ -130,7 +134,7 @@ jobs:
   release:
     name: Create Release
     needs: build
-    if: startsWith(github.ref, 'refs/tags/')
+    if: startsWith(github.ref, 'refs/tags/') || inputs.release_tag != ''
     runs-on: ubuntu-latest
     steps:
       - name: Checkout code
@@ -153,10 +157,8 @@ jobs:
 
       - name: Upload Assets to Release
         run: |
-          # Extract version from ref (remove refs/tags/ prefix)
-          VERSION=${GITHUB_REF#refs/tags/}
-          
-          # Upload Linux x86_64 asset
+          VERSION="${{ inputs.release_tag != '' && inputs.release_tag || github.ref_name }}"
+
           gh release upload $VERSION --clobber --repo $GITHUB_REPOSITORY \
             artifacts/gnd-linux-x86_64/gnd-linux-x86_64.gz \
             artifacts/gnd-linux-aarch64/gnd-linux-aarch64.gz \
@@ -169,7 +171,7 @@ jobs:
   publish-npm:
     name: Publish npm package for ${{ matrix.platform }}
     needs: release
-    if: startsWith(github.ref, 'refs/tags/')
+    if: startsWith(github.ref, 'refs/tags/') || inputs.release_tag != ''
     runs-on: ubuntu-latest
     permissions:
       id-token: write
@@ -212,7 +214,7 @@ jobs:
         env:
           GH_TOKEN: ${{ github.token }}
         run: |
-          gh release download "${{ github.ref_name }}" \
+          gh release download "${{ inputs.release_tag != '' && inputs.release_tag || github.ref_name }}" \
             --repo "${{ github.repository }}" \
             --pattern "${{ matrix.asset }}" \
             --output ./binary-archive
@@ -232,7 +234,7 @@ jobs:
         id: version
         shell: bash
         run: |
-          VERSION="${{ github.ref_name }}"
+          VERSION="${{ inputs.release_tag != '' && inputs.release_tag || github.ref_name }}"
           VERSION="${VERSION#v}"
           echo "version=${VERSION}" >> $GITHUB_OUTPUT
           # Prerelease versions (e.g. 0.42.2-dev.1) need an explicit --tag
@@ -283,7 +285,7 @@ jobs:
   publish-npm-wrapper:
     name: Publish @graphprotocol/gnd wrapper
     needs: publish-npm
-    if: startsWith(github.ref, 'refs/tags/')
+    if: startsWith(github.ref, 'refs/tags/') || inputs.release_tag != ''
     runs-on: ubuntu-latest
     permissions:
       id-token: write
@@ -299,7 +301,7 @@ jobs:
         id: version
         shell: bash
         run: |
-          VERSION="${{ github.ref_name }}"
+          VERSION="${{ inputs.release_tag != '' && inputs.release_tag || github.ref_name }}"
           VERSION="${VERSION#v}"
           echo "version=${VERSION}" >> $GITHUB_OUTPUT
           if [[ "$VERSION" == *-* ]]; then
```

**File**: `Cargo.lock` (modified, +8/-8)
```diff
@@ -876,9 +876,9 @@ dependencies = [
 
 [[package]]
 name = "anstream"
-version = "0.6.14"
+version = "0.6.21"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "418c75fa768af9c03be99d17643f93f79bbba589895012a80e3452a19ddda15b"
+checksum = "43d5b281e737544384e969a5ccad3f1cdd24b48086a0fc1b2a5262a26b8f4f4a"
 dependencies = [
  "anstyle",
  "anstyle-parse 0.2.4",
@@ -945,7 +945,7 @@ checksum = "291e6a250ff86cd4a820112fb8898808a366d8f9f58ce16d1f538353ad55747d"
 dependencies = [
  "anstyle",
  "once_cell_polyfill",
- "windows-sys 0.60.2",
+ "windows-sys 0.61.2",
 ]
 
 [[package]]
@@ -2148,7 +2148,7 @@ version = "4.5.8"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "c1c09dd5ada6c6c78075d6fd0da3f90d8080651e2d6cc8eb2f1aaa4034ced708"
 dependencies = [
- "anstream 0.6.14",
+ "anstream 0.6.21",
  "anstyle",
  "clap_lex",
  "strsim",
@@ -6672,7 +6672,7 @@ dependencies = [
  "once_cell",
  "socket2",
  "tracing",
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -7165,7 +7165,7 @@ dependencies = [
  "errno",
  "libc",
  "linux-raw-sys 0.12.1",
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -7246,7 +7246,7 @@ dependencies = [
  "security-framework 3.7.0",
  "security-framework-sys",
  "webpki-root-certs",
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
@@ -8148,7 +8148,7 @@ dependencies = [
  "getrandom 0.4.2",
  "once_cell",
  "rustix 1.1.4",
- "windows-sys 0.60.2",
+ "windows-sys 0.59.0",
 ]
 
 [[package]]
```

---

### Incident Patch 4: `757ff94b` (2026-05-04)
**Commit Message**: graph: Remove debug prefix from Timestamp value parse errors

Based on a suggestion by cuiweixie

**File**: `graph/src/data/store/mod.rs` (modified, +1/-1)
```diff
@@ -371,7 +371,7 @@ impl Value {
                         Value::Timestamp(scalar::Timestamp::parse_timestamp(s).map_err(|_| {
                             QueryExecutionError::ValueParseError(
                                 "Timestamp".to_string(),
-                                format!("xxx{}", s),
+                                s.to_string(),
                             )
                         })?)
                     }
```

---

### Incident Patch 5: `de95257e` (2025-04-03)
**Commit Message**: store: Revert entity versions during copy instead of after

Reverting entities after copying can be very slow; the step is also
unnecessary since we already know during copying which entity versions need
to be unclamped and we never copy versions that would have to be deleted by
the revert.

We move the revert logic into CopyEntityBatchQuery so that entity versions
are reverted as they are copied rather than in a separate revert_block pass
after copying completes.

The post-copy revert_block call in start_subgraph is kept as a no-op safety
net for copies that were started with older code and resumed after
upgrading. It can be removed once a release with this logic has been out
for long enough.

**File**: `store/postgres/src/copy.rs` (modified, +25/-9)
```diff
@@ -178,7 +178,14 @@ impl CopyState {
         dst: Arc<Layout>,
         target_block: BlockPtr,
     ) -> Result<CopyState, StoreError> {
-        let tables = TableState::load(conn, primary, src.as_ref(), dst.as_ref()).await?;
+        let tables = TableState::load(
+            conn,
+            primary,
+            src.as_ref(),
+            dst.as_ref(),
+            target_block.number,
+        )
+        .await?;
         let (finished, mut unfinished): (Vec<_>, Vec<_>) =
             tables.into_iter().partition(|table| table.finished());
         unfinished.sort_by_key(|table| table.dst.object.to_string());
@@ -329,6 +336,7 @@ struct TableState {
     dst_site: Arc<Site>,
     batcher: VidBatcher,
     duration_ms: i64,
+    target_block: BlockNumber,
 }
 
 impl TableState {
@@ -351,6 +359,7 @@ impl TableState {
             dst_site,
             batcher,
             duration_ms: 0,
+            target_block: target_block.number,
         })
     }
 
@@ -363,6 +372,7 @@ impl TableState {
         primary: Primary,
         src_layout: &Layout,
         dst_layout: &Layout,
+        target_block: BlockNumber,
     ) -> Result<Vec<TableState>, StoreError> {
         use copy_table_state as cts;
 
@@ -429,6 +439,7 @@ impl TableState {
                 dst_site: dst_layout.site.clone(),
                 batcher,
                 duration_ms,
+                target_block,
             };
             states.push(state);
         }
@@ -503,15 +514,20 @@ impl TableState {
     }
 
     async fn copy_batch(&mut self, conn: &mut AsyncPgConnection) -> Result<Status, StoreError> {
-        let (duration, count) = self
+        let (duration, count): (_, Option<i32>) = self
             .batcher
-            .step(async |start, end| {
-                let count =
-                    rq::CopyEntityBatchQuery::new(self.dst.as_ref(), &self.src, start, end)?
-                        .count_current()
-                        .get_result::<i64>(conn)
-                        .await
-                        .optional()?;
+            .step(async |start: i64, end: i64| {
+                let count = rq::CopyEntityBatchQuery::new(
+                    self.dst.as_ref(),
+                    &self.src,
+                    start,
+                    end,
+                    self.target_block,
+                )?
+                .count_current()
+                .get_result::<i64>(conn)
+                .await
+                .optional()?;
                 Ok(count.unwrap_or(0) as i32)
             })
             .await?;
```

**File**: `store/postgres/src/deployment_store.rs` (modified, +15/-5)
```diff
@@ -1651,11 +1651,21 @@ impl DeploymentStore {
                             .await?;
                     }
 
-                    // Rewind the subgraph so that entity versions that are
-                    // clamped in the future (beyond `block`) become valid for
-                    // all blocks after `block`. `revert_block` gets rid of
-                    // everything including the block passed to it. We want to
-                    // preserve `block` and therefore revert `block+1`
+                    // CopyEntityBatchQuery now reverts entity versions
+                    // during copying, making this rewind redundant for new
+                    // copies. We keep it for backward compatibility: a copy
+                    // that was started before this change and is resumed
+                    // after upgrading will have already-copied rows that
+                    // weren't reverted during copy. For data that was
+                    // already reverted during copy, this is a no-op. This
+                    // code can be removed once a release with this change
+                    // has been out for a while and we are sure that there
+                    // are no more copies in progress that started before
+                    // the change
+                    //
+                    // `revert_block` gets rid of everything including the
+                    // block passed to it. We want to preserve `block` and
+                    // therefore revert `block+1`
                     let start = Instant::now();
                     let block_to_revert: BlockNumber = block
                         .number
```

**File**: `store/postgres/src/relational_queries.rs` (modified, +23/-1)
```diff
@@ -5091,6 +5091,7 @@ pub struct CopyEntityBatchQuery<'a> {
     columns: Vec<&'a Column>,
     first_vid: i64,
     last_vid: i64,
+    target_block: BlockNumber,
 }
 
 impl<'a> CopyEntityBatchQuery<'a> {
@@ -5099,6 +5100,7 @@ impl<'a> CopyEntityBatchQuery<'a> {
         src: &'a Table,
         first_vid: i64,
         last_vid: i64,
+        target_block: BlockNumber,
     ) -> Result<Self, StoreError> {
         let mut columns = Vec::new();
         for dcol in &dst.columns {
@@ -5125,6 +5127,7 @@ impl<'a> CopyEntityBatchQuery<'a> {
             columns,
             first_vid,
             last_vid,
+            target_block,
         })
     }
 
@@ -5209,7 +5212,16 @@ impl<'a> QueryFragment<Pg> for CopyEntityBatchQuery<'a> {
                 );
                 out.push_sql(&checked_conversion);
             }
-            (false, false) => out.push_sql(BLOCK_RANGE_COLUMN),
+            (false, false) => {
+                let range_conv = format!(
+                    r#"
+                case when upper({BLOCK_RANGE_COLUMN}) > {}
+                     then int4range(lower({BLOCK_RANGE_COLUMN}), null)
+                     else {BLOCK_RANGE_COLUMN} end"#,
+                    self.target_block
+                );
+                out.push_sql(&range_conv)
+            }
         }
 
         match (self.src.has_causality_region, self.dst.has_causality_region) {
@@ -5239,6 +5251,16 @@ impl<'a> QueryFragment<Pg> for CopyEntityBatchQuery<'a> {
         out.push_bind_param::<BigInt, _>(&self.first_vid)?;
         out.push_sql(" and vid <= ");
         out.push_bind_param::<BigInt, _>(&self.last_vid)?;
+        out.push_sql(" and ");
+        if self.src.immutable {
+            out.push_sql(BLOCK_COLUMN);
+        } else {
+            out.push_sql("lower(");
+            out.push_sql(BLOCK_RANGE_COLUMN);
+            out.push_sql(")");
+        }
+        out.push_sql(" <= ");
+        out.push_bind_param::<Integer, _>(&self.target_block)?;
         out.push_sql("\n returning ");
         if self.dst.immutable {
             out.push_sql("true");
```

#### Recent Merged Pull Requests:
- **PR #6715** (2026-08-25): all: Drop arrayref by bumping blake3 and stable-hash (@incrypto32)
- **PR #6703** (2026-08-03): v0.45.0 release (@incrypto32)
- **PR #6688** (2026-07-20): store: Modernize layout example to use clap derive API (@lutter)
- **PR #6687** (2026-07-20): store: Populate fulltext columns when copying a subgraph (@lutter)
- **PR #6685** (2026-07-17): build(deps): bump serde_with from 3.12.0 to 3.21.0 (@dependabot[bot])
- **PR #6682** (2026-07-17): build(deps): bump prost-types from 0.14.3 to 0.14.4 (@dependabot[bot])
- **PR #6681** (2026-07-17): build(deps): bump base64 from 0.21.7 to 0.22.1 (@dependabot[bot])
- **PR #6671** (2026-07-07): build(deps): bump prost from 0.14.3 to 0.14.4 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
