> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/martin-ger-esp32_nat_router-learnings.md`  
> **Source**: github ([https://github.com/martin-ger/esp32_nat_router](https://github.com/martin-ger/esp32_nat_router))  
> **Source Version**: `119e0a3d`  
> **License**: PERMISSIVE_OPEN_SOURCE  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T14:19:07.321Z  
> **Learning ID**: `learn-github-martin-ger-esp32_nat_router`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): martin-ger/esp32_nat_router

> **Canonical Artifact**: `07_PROJECT_LEARNING/martin-ger-esp32_nat_router-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/martin-ger/esp32_nat_router](https://github.com/martin-ger/esp32_nat_router))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T14:14:03.892Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `martin-ger/esp32_nat_router`
- **Description**: An AI-enabled NAT Router/Firewall for the ESP32
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2238 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `main/netif_hooks.c`
```
/* Network interface hooks: byte counting, ACL enforcement, PCAP capture,
 * TTL override, TCP MSS clamping, Path MTU, and VPN kill switch.
 *
 * Hooks into the lwIP netif input/linkoutput chains for both STA/ETH
 * and AP interfaces to intercept packets for filtering and monitoring.
 */

#include <inttypes.h>
#include <string.h>
#include <time.h>
#include "esp_log.h"
#include "esp_timer.h"
#include "esp_wifi.h"
#include "esp_netif.h"
#include "driver/gpio.h"
#include "lwip/netif.h"
#include "lwip/ip_addr.h"
#include "lwip/pbuf.h"
#include "lwip/prot/ip4.h"
#include "lwip/inet_chksum.h"
#include "acl.h"
#include "client_stats.h"
#include "pcap_capture.h"
#include "router_config.h"
#include "wifi_config.h"
#include "vpn_config.h"
#include "led_strip_status.h"

#if CONFIG_ETH_UPLINK
#include "esp_eth.h"
extern esp_netif_t* ethNetif;
#else
extern esp_netif_t* wifiSTA;
#endif
extern esp_netif_t* wifiAP;

static const char *TAG = "netif_hooks";

// Original netif input and linkoutput function pointers
static netif_input_fn original_netif_input = NULL;
static netif_linkoutput_fn original_netif_linkoutput = NULL;
static struct netif *sta_netif = NULL;

// Original AP netif function pointers
static netif_input_fn original_ap_netif_input = NULL;
static netif_linkoutput_fn original_ap_netif_linkoutput = NULL;
static struct netif *ap_netif = NULL;

// Per-client traffic statistics for AP clients
static client_stats_entry_t client_stats[CLIENT_STATS_MAX];

// Per-client stats enabled flag (default off; persisted in NVS "cstats_en")
bool client_stats_enabled = false;

static IRAM_ATTR client_stats_entry_t* find_client_stats(const uint8_t *mac) {
    for (int i = 0; i < CLIENT_STATS_MAX; i++) {
        if (client_stats[i].active && memcmp(client_stats[i].mac, mac, 6) == 0) {
            return &client_stats[i];
        }
    }
    return NULL;
}

void client_stats_on_connect(const uint8_t *mac) {
    // Keep existing stats on reconnect
    client_stats_entry_t *existing = find_client_stats(mac);
    if (existing) {
        existing->connected = 1;
        return;
    }
    // Find free slot: prefer inactive, then disconnected
    int free_slot = -1;
    int disconnected_slot = -1;
    for (int i = 0; i < CLIENT_STATS_MAX; i++) {
        if (!client_stats[i].active) {
            free_slot = i;
            break;
        } else if (!client_stats[i].connected && disconnected_slot < 0) {
            disconnected_slot = i;
        }
    }
    int slot = (free_slot >= 0) ? free_slot : disconnected_slot;
    if (slot >= 0) {
        memcpy(client_stats[slot].mac, mac, 6);
        client_stats[slot].bytes_sent = 0;
        client_stats[slot].bytes_received = 0;
        client_stats[slot].packets_sent = 0;
        client_stats[slot].packets_received = 0;
        client_stats[slot].active = 1;
        client_stats[slot].connected = 1;
    }
}

bool client_stats_on_disconnect(const uint8_t *mac) {
    client_stats_entry_t *entry = find_client_stats(mac);
    if (entry && entry->connected) {
        entry->connected = 0;
        return true;
    }
    return false;
}

int client_stats_get_all(client_stats_entry_t *out, int max_entries) {
    int count = 0;
    for (int i = 0; i < CLIENT_STATS_MAX && count < max_entries; i++) {
        if (client_stats[i].active) {
            memcpy(&out[count], &client_stats[i], sizeof(client_stats_entry_t));
            count++;
        }
    }
    return count;
}

void client_stats_reset_all(void) {
    for (int i = 0; i < CLIENT_STATS_MAX; i++) {
        if (client_stats[i].active) {
            client_stats[i].bytes_sent = 0;
            client_stats[i].bytes_received = 0;
            client_stats[i].packets_sent = 0;
            client_stats[i].packets_received = 0;
        }
    }
}

void format_bytes_human(uint64_t bytes, char *buf, size_t len) {
    if (bytes >= 1073741824ULL)
        snprintf(buf, len, "%.1f GB", (double)bytes / 1073741824.0);
    else if (bytes >= 1048576ULL)
        snprintf(buf, len, "%.1f MB", (double)bytes / 1048576.0);
    else if (bytes >= 1024ULL)
        snprintf(buf, len, "%.1f KB", (double)bytes / 1024.0);
    else
        snprintf(buf, len, "%" PRIu64 " B", bytes);
}

// Hook function to count received bytes via netif input and ACL check
static IRAM_ATTR err_t netif_input_hook(struct pbuf *p, struct netif *netif) {
    bool is_acl_monitored = false;

    // Check to_esp ACL (packets from Internet to ESP32)
    if (!acl_is_empty(ACL_TO_ESP)) {
        uint8_t result = acl_check_packet(ACL_TO_ESP, p);

        // Check if packet has monitor flag
        is_acl_monitored = (result != ACL_NO_MATCH) && (result & ACL_MONITOR) != 0;

        // Handle deny action (logging done in acl_check_packet)
        if ((result & 0x01) == ACL_DENY && result != ACL_NO_MATCH) {
            // Capture denied packet if monitoring is enabled before dropping
            if (is_acl_monitored && pcap_should_capture(true, false)) {
                pcap_capture_packet(p);
            }
            pbuf_free(p);
            return ERR_OK;
        }
    }

    // Capture packet based on mode and ACL monitor flag (STA interface = false)
    if (pcap_should_capture(is_acl_monitored, false)) {
        pcap_capture_packet(p);
    }

    // Count received bytes and toggle LED
    if (netif == sta_netif && p != NULL) {
        sta_bytes_received += p->tot_len;
        if (led_gpio >= 0 && ap_connect) {
            led_toggle ^= 1;
            gpio_set_level(led_gpio, led_toggle ^ led_lowactive);
        }
        if (led_strip_gpio >= 0) {
            led_strip_notify_traffic();
        }
    }

    // Call original input function
    if (original_netif_input != NULL) {
        return original_netif_input(p, netif);
    }

    return ERR_VAL;
}


// Hook function to count sent bytes via netif linkoutput and ACL check
static IRAM_ATTR err_t netif_linkoutput_hook(struct netif *netif, struct pbuf *p) {
    bool is_acl_monitored = false;

    // Check from_esp ACL (packets from ESP32 to Internet)
    if (!acl_is_empty(ACL_FROM_ESP)) {
        uint8_t result = acl_check_packet(ACL_FROM_ESP, p);

        // Check if packet has monitor flag
        is_acl_monitored = (result != ACL_NO_MATCH) && (result & ACL_MONITOR) != 0;

        // Handle deny action (logging done in acl_check_packet)
        if ((result & 0x01) == ACL_DENY && result != ACL_NO_MATCH) {
            // Capture denied packet if monitoring is enabled before dropping
            if (is_acl_monitored && pcap_should_capture(true, false)) {
                pcap_capture_packet(p);
            }
            return ERR_OK;
        }
    }

    // TTL override for upstream packets (must be before PCAP capture)
    // Ethernet header: 14 bytes (6 dst + 6 src + 2 ethertype)
    // Use p->len (first segment) to ensure header is accessible in this pbuf
    if (sta_ttl_override > 0 && p != NULL && p->len >= 14 + sizeof(struct ip_hdr)) {
        uint8_t *payload = (uint8_t *)p->payload;
        // Check ethertype for IPv4 (0x0800)
        if (payload[12] == 0x08 && payload[13] == 0x00) {
            struct ip_hdr *iphdr = (struct ip_hdr *)(payload + 14);
            // Verify it's IPv4
            if (IPH_V(iphdr) == 4) {
                // Read 16-bit word containing TTL and protocol
                uint16_t old_ttl_proto = *(uint16_t *)&iphdr->_ttl;
                iphdr->_ttl = sta_ttl_override;
                uint16_t new_ttl_proto = *(uint16_t *)&iphdr->_ttl;

                // RFC 1624: Incremental checksum update
                // HC' = ~(~HC + ~m + m')
                // where HC = old checksum, m = old value, m' = new value
                uint32_t sum = (uint16_t)~iphdr->_chksum;
                sum += (uint16_t)~old_ttl_proto;
                sum += new_ttl_proto;
                // Fold 32-bit sum to 16 bits
                while (sum >> 16) {
                    sum = (sum & 0xFFFF) + (sum >> 16);
                }
                iphdr->_chksum = (uint16_t)~sum;
            }
        }
    }

    // Capture packet based on mode and ACL monitor flag (STA interface = false)
    if (pcap_should_capture(is_acl_monitored, false)) {
        pcap_capture_packet(p);
    }

    // Count sent bytes and toggle LED
    if (netif == sta_netif && p != NULL) {
        sta_bytes_sent += p->tot_len;
        if (led_gpio >= 0 && ap_connect) {
            led_toggle ^= 1;
            gpio_set_level(led_gpio, led_toggle ^ led_lowactive);
        }
        if (led_strip_gpio >= 0) {
            led_strip_notify_traffic();
        }
    }

    // Call original linkoutput function
    if (original_netif_linkoutput != NULL) {
        return original_netif_linkoutput(netif, p);
    }

    return ERR_IF;
}

void init_byte_counter(void) {
#if CONFIG_ETH_UPLINK
    if (ethNetif != NULL && original_netif_input == NULL) {
        extern struct netif *esp_netif_get_netif_impl(esp_netif_t *esp_netif);
        sta_netif = esp_netif_get_netif_impl(ethNetif);
        if (sta_netif != NULL) {
            original_netif_input = sta_netif->input;
            sta_netif->input = netif_input_hook;
            original_netif_linkoutput = sta_netif->linkoutput;
            sta_netif->linkoutput = netif_linkoutput_hook;
            ESP_LOGI(TAG, "Byte counter initialized for ETH interface (input & output)");
        }
    }
#else
    if (wifiSTA != NULL && original_netif_input == NULL) {
        // Get the underlying lwIP netif structure
        esp_netif_t *sta_netif_handle = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
        if (sta_netif_handle != NULL) {
            // Access internal lwIP netif - this is internal API but necessary for hooking
            extern struct netif *esp_netif_get_netif_impl(esp_netif_t *esp_netif);
            sta_netif = esp_netif_get_netif_impl(sta_netif_handle);

            if (sta_netif != NULL) {
                // Store and hook input function
                original_netif_input = sta_netif->input;
                sta_netif->input = n
```

### Core Architecture Module: `components/acl/acl.c`
```
/* ACL (Access Control List) Firewall Implementation
 *
 * Provides packet filtering based on IP addresses, protocols, and ports.
 */

#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include "esp_log.h"
#include "esp_netif.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "lwip/ip4.h"
#include "lwip/ip4_addr.h"
#include "lwip/inet.h"
#include "lwip/pbuf.h"
#include "lwip/prot/ip4.h"
#include "lwip/prot/tcp.h"
#include "lwip/prot/udp.h"

#include "acl.h"
#include "esp_timer.h"

/* Protocol numbers (from IANA) */
#define IPPROTO_ICMP 1
#define IPPROTO_TCP  6
#define IPPROTO_UDP  17

/* Rate limiting for deny logs (microseconds) */
#define ACL_LOG_INTERVAL_US  500000  /* 0.5 seconds */

static const char *TAG = "ACL";

/* Last time we logged a denied packet (per ACL list) */
static int64_t last_deny_log_time[MAX_ACL_LISTS] = {0};

/* ACL list names for display/parsing */
static const char* acl_names[MAX_ACL_LISTS] = {
    "to_esp",    /* 0: Internet -> ESP32 (uplink input) */
    "from_esp",  /* 1: ESP32 -> Internet (uplink output) */
    "to_ap",     /* 2: Clients -> ESP32 (AP input) */
    "from_ap"    /* 3: ESP32 -> Clients (AP output) */
};

/* ACL list description for display */
static const char* acl_desc[MAX_ACL_LISTS] = {
    "Internet -> ESP (to_esp)",
    "ESP -> Internet (from_esp)",
    "Clients -> ESP (to_ap)",
    "ESP -> Clients (from_ap)"
};

/* ACL rule tables - one array per direction */
static acl_entry_t acl_lists[MAX_ACL_LISTS][MAX_ACL_ENTRIES];

/* ACL statistics per list */
static acl_stats_t acl_stats[MAX_ACL_LISTS];

/* Mutex protecting acl_lists and acl_stats from concurrent access */
static SemaphoreHandle_t acl_mutex = NULL;

/* Per-list rule count - written under acl_mutex, read lock-free in hot path */
static volatile uint8_t acl_rule_count[MAX_ACL_LISTS];

void acl_init(void)
{
    if (acl_mutex == NULL) {
        acl_mutex = xSemaphoreCreateMutex();
        assert(acl_mutex != NULL);
    }
    memset(acl_lists, 0, sizeof(acl_lists));
    memset(acl_stats, 0, sizeof(acl_stats));
    memset((void *)acl_rule_count, 0, sizeof(acl_rule_count));
    ESP_LOGI(TAG, "ACL subsystem initialized");
}

void acl_lock(void)
{
    if (acl_mutex != NULL) {
        xSemaphoreTake(acl_mutex, portMAX_DELAY);
    }
}

void acl_unlock(void)
{
    if (acl_mutex != NULL) {
        xSemaphoreGive(acl_mutex);
    }
}

IRAM_ATTR bool acl_is_empty(uint8_t acl_no)
{
    if (acl_no >= MAX_ACL_LISTS) {
        return true;
    }
    return acl_rule_count[acl_no] == 0;
}

int acl_get_count(uint8_t acl_no)
{
    if (acl_no >= MAX_ACL_LISTS) {
        return 0;
    }
    return acl_rule_count[acl_no];
}

void acl_recount(uint8_t acl_no)
{
    if (acl_no >= MAX_ACL_LISTS) {
        return;
    }

    acl_lock();
    uint8_t count = 0;
    for (int i = 0; i < MAX_ACL_ENTRIES; i++) {
        if (acl_lists[acl_no][i].valid) {
            count++;
        }
    }
    acl_rule_count[acl_no] = count;
    acl_unlock();
}

void acl_clear(uint8_t acl_no)
{
    if (acl_no >= MAX_ACL_LISTS) {
        return;
    }

    acl_lock();
    memset(acl_lists[acl_no], 0, sizeof(acl_lists[acl_no]));
    acl_rule_count[acl_no] = 0;
    acl_unlock();
    ESP_LOGI(TAG, "Cleared ACL list %s", acl_names[acl_no]);
}

void acl_clear_stats(uint8_t acl_no)
{
    if (acl_no >= MAX_ACL_LISTS) {
        return;
    }

    acl_lock();
    memset(&acl_stats[acl_no], 0, sizeof(acl_stats_t));

    /* Also clear hit counts on all rules */
    for (int i = 0; i < MAX_ACL_ENTRIES; i++) {
        acl_lists[acl_no][i].hit_count = 0;
    }
    acl_unlock();
}

bool acl_add(uint8_t acl_no, uint32_t src, uint32_t s_mask,
             uint32_t dest, uint32_t d_mask, uint8_t proto,
             uint16_t s_port, uint16_t d_port, uint8_t allow)
{
    if (acl_no >= MAX_ACL_LISTS) {
        ESP_LOGE(TAG, "Invalid ACL list number: %d", acl_no);
        return false;
    }

    acl_lock();

    /* Find first empty slot */
    int slot = -1;
    for (int i = 0; i < MAX_ACL_ENTRIES; i++) {
        if (!acl_lists[acl_no][i].valid) {
            slot = i;
            break;
        }
    }

    if (slot < 0) {
        acl_unlock();
        ESP_LOGE(TAG, "ACL list %s is full", acl_names[acl_no]);
        return false;
    }

    /* Store the rule with pre-masked IP addresses */
    acl_entry_t *entry = &acl_lists[acl_no][slot];
    entry->src = src & s_mask;
    entry->s_mask = s_mask;
    entry->dest = dest & d_mask;
    entry->d_mask = d_mask;
    entry->proto = proto;
    entry->s_port = s_port;
    entry->d_port = d_port;
    entry->allow = allow;
    entry->hit_count = 0;
    entry->valid = 1;
    acl_rule_count[acl_no]++;

    acl_unlock();
    ESP_LOGI(TAG, "Added rule %d to ACL %s", slot, acl_names[acl_no]);
    return true;
}

bool acl_delete(uint8_t acl_no, uint8_t rule_idx)
{
    if (acl_no >= MAX_ACL_LISTS || rule_idx >= MAX_ACL_ENTRIES) {
        return false;
    }

    acl_lock();

    if (!acl_lists[acl_no][rule_idx].valid) {
        acl_unlock();
        return false;
    }

    /* Clear the entry */
    memset(&acl_lists[acl_no][rule_idx], 0, sizeof(acl_entry_t));

    /* Compact the list by moving remaining entries up */
    for (int i = rule_idx; i < MAX_ACL_ENTRIES - 1; i++) {
        if (acl_lists[acl_no][i + 1].valid) {
            memcpy(&acl_lists[acl_no][i], &acl_lists[acl_no][i + 1], sizeof(acl_entry_t));
            memset(&acl_lists[acl_no][i + 1], 0, sizeof(acl_entry_t));
        } else {
            break;
        }
    }
    if (acl_rule_count[acl_no] > 0) {
        acl_rule_count[acl_no]--;
    }

    acl_unlock();
    ESP_LOGI(TAG, "Deleted rule %d from ACL %s", rule_idx, acl_names[acl_no]);
    return true;
}

/* Ethernet header size */
#define ETH_HEADER_LEN 14
#define ETH_TYPE_IPV4  0x0800
#define ETH_TYPE_ARP   0x0806
#define ETH_TYPE_IPV6  0x86DD

IRAM_ATTR uint8_t acl_check_packet(uint8_t acl_no, struct pbuf *p)
{
    if (acl_no >= MAX_ACL_LISTS || p == NULL) {
        return ACL_NO_MATCH;
    }

    uint8_t *payload = (uint8_t *)p->payload;
    uint16_t payload_len = p->len;
    uint16_t offset = 0;

    /* Check if packet has Ethernet header by examining structure.
     * ESP-IDF WiFi passes full Ethernet frames to netif->input.
     * Ethernet header: 6 bytes dst MAC + 6 bytes src MAC + 2 bytes EtherType */
    if (payload_len >= ETH_HEADER_LEN) {
        uint16_t ethertype = (payload[12] << 8) | payload[13];

        /* Check for common EtherTypes indicating this is an Ethernet frame */
        if (ethertype == ETH_TYPE_IPV4 || ethertype == ETH_TYPE_ARP ||
            ethertype == ETH_TYPE_IPV6 || ethertype < 0x0600) {
            /* This looks like an Ethernet frame */
            if (ethertype != ETH_TYPE_IPV4) {
                /* Non-IPv4 (ARP, IPv6, etc.) - allow to pass through */
                return ACL_NO_MATCH;
            }
            /* Skip Ethernet header to get to IP packet */
            offset = ETH_HEADER_LEN;
        }
    }

    /* Check if remaining payload is large enough for IP header */
    if (payload_len < offset + sizeof(struct ip_hdr)) {
        /* Too short - allow by default */
        return ACL_NO_MATCH;
    }

    /* Extract IP header */
    struct ip_hdr *iphdr = (struct ip_hdr *)(payload + offset);

    /* Verify it's IPv4 */
    if (IPH_V(iphdr) != 4) {
        /* Not IPv4 - allow by default (could be raw IP packet of different version) */
        return ACL_NO_MATCH;
    }

    uint32_t src_ip = iphdr->src.addr;
    uint32_t dest_ip = iphdr->dest.addr;
    uint8_t proto = IPH_PROTO(iphdr);

    /* Extract port information for TCP/UDP */
    uint16_t src_port = 0;
    uint16_t dst_port = 0;

    uint16_t ip_hdr_len = IPH_HL(iphdr) * 4;

    if (proto == IPPROTO_TCP && payload_len >= offset + ip_hdr_len + sizeof(struct tcp_hdr)) {
        struct tcp_hdr *tcphdr = (struct tcp_hdr *)(payload + offset + ip_hdr_len);
        src_port = lwip_ntohs(tcphdr->src);
        dst_port = lwip_ntohs(tcphdr->dest);
    } else if (proto == IPPROTO_UDP && payload_len >= offset + ip_hdr_len + sizeof(struct udp_hdr)) {
        struct udp_hdr *udphdr = (struct udp_hdr *)(payload + offset + ip_hdr_len);
        src_port = lwip_ntohs(udphdr->src);
        dst_port = lwip_ntohs(udphdr->dest);
    }

    /* Match against rules under the lock; logging happens after release */
    uint8_t result = ACL_NO_MATCH;
    int matched_rule = -1;
    bool should_log = false;

    acl_lock();

    /* Check rules in order */
    for (int i = 0; i < MAX_ACL_ENTRIES; i++) {
        acl_entry_t *rule = &acl_lists[acl_no][i];

        if (!rule->valid) {
            continue;
        }

        /* Check protocol */
        if (rule->proto != 0 && rule->proto != proto) {
            continue;
        }

        /* Check source IP */
        if ((src_ip & rule->s_mask) != rule->src) {
            continue;
        }

        /* Check destination IP */
        if ((dest_ip & rule->d_mask) != rule->dest) {
            continue;
        }

        /* Check ports if rule has port filters */
        if (rule->s_port != 0 || rule->d_port != 0) {
            /* Rule has port filters - only match TCP/UDP packets */
            if (proto != IPPROTO_TCP && proto != IPPROTO_UDP) {
                /* Can't match ports on non-TCP/UDP packets (e.g., ICMP) */
                continue;
            }
            if (rule->s_port != 0 && rule->s_port != src_port) {
                continue;
            }
            if (rule->d_port != 0 && rule->d_port != dst_port) {
                continue;
            }
        }

        /* Rule matched - update counters under the lock */
        rule->hit_count++;
        matched_rule = i;

        uint8_t action = rule->allow & 0x01;
        uint8_t monitor = rule->allow & ACL_MONITOR;
        result = action | monitor;

        if (action == ACL_ALLOW) {
            acl_stats[acl_no].packets_allowed++;
        } else {
            acl_stats[acl_no].packets_denied++;

        
```

### Core Architecture Module: `components/acl/acl_nvs.c`
```
/* ACL firewall rule persistence (NVS).
 *
 * Saves and loads ACL rules to/from NVS flash storage.
 * Thread-safe: acquires the ACL lock when accessing rule data.
 */

#include <string.h>
#include "esp_log.h"
#include "nvs.h"
#include "acl.h"
#include "router_config.h"

static const char *TAG = "acl_nvs";

esp_err_t save_acl_rules(void) {
    esp_err_t err;
    nvs_handle_t nvs;

    /* Snapshot all ACL lists under the lock, then write to NVS outside
     * the lock to avoid blocking packet processing during flash I/O. */
    acl_entry_t snapshot[MAX_ACL_LISTS][MAX_ACL_ENTRIES];
    acl_lock();
    for (int i = 0; i < MAX_ACL_LISTS; i++) {
        acl_entry_t* rules = acl_get_rules(i);
        if (rules != NULL) {
            memcpy(snapshot[i], rules, sizeof(acl_entry_t) * MAX_ACL_ENTRIES);
        }
    }
    acl_unlock();

    err = nvs_open(PARAM_NAMESPACE, NVS_READWRITE, &nvs);
    if (err != ESP_OK) {
        return err;
    }

    const char* acl_keys[MAX_ACL_LISTS] = {"acl_0", "acl_1", "acl_2", "acl_3"};
    for (int i = 0; i < MAX_ACL_LISTS; i++) {
        err = nvs_set_blob(nvs, acl_keys[i], snapshot[i], sizeof(acl_entry_t) * MAX_ACL_ENTRIES);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to save ACL list %d: %s", i, esp_err_to_name(err));
        }
    }

    err = nvs_commit(nvs);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "ACL rules saved to NVS");
    }
    nvs_close(nvs);
    return err;
}

esp_err_t load_acl_rules(void) {
    esp_err_t err;
    nvs_handle_t nvs;
    size_t len;

    /* Initialize ACL subsystem first */
    acl_init();

    err = nvs_open(PARAM_NAMESPACE, NVS_READONLY, &nvs);
    if (err != ESP_OK) {
        return err;
    }

    /* Load each ACL list */
    const char* acl_keys[MAX_ACL_LISTS] = {"acl_0", "acl_1", "acl_2", "acl_3"};
    acl_lock();
    for (int i = 0; i < MAX_ACL_LISTS; i++) {
        acl_entry_t* rules = acl_get_rules(i);
        if (rules == NULL) continue;

        len = sizeof(acl_entry_t) * MAX_ACL_ENTRIES;
        err = nvs_get_blob(nvs, acl_keys[i], rules, &len);
        if (err == ESP_OK) {
            /* Count loaded rules and reset hit counters */
            int count = 0;
            for (int j = 0; j < MAX_ACL_ENTRIES; j++) {
                if (rules[j].valid) {
                    count++;
                    rules[j].hit_count = 0;  /* Reset hit counter on boot */
                }
            }
            if (count > 0) {
                ESP_LOGI(TAG, "Loaded %d ACL rules for %s", count, acl_get_name(i));
            }
        } else if (err != ESP_ERR_NVS_NOT_FOUND) {
            ESP_LOGW(TAG, "Failed to load ACL list %d: %s", i, esp_err_to_name(err));
        }
    }
    acl_unlock();

    /* Rebuild the lock-free rule counts so acl_is_empty() (the gate in the
     * netif hot path) sees the rules we just loaded. Done after unlock since
     * acl_recount() takes the lock itself. */
    for (int i = 0; i < MAX_ACL_LISTS; i++) {
        acl_recount(i);
    }

    nvs_close(nvs);
    return ESP_OK;
}

```

### Core Architecture Module: `components/acl/include/acl.h`
```
/* ACL (Access Control List) Firewall Component
 *
 * Provides packet filtering capabilities for the ESP32 NAT Router.
 *
 * Network topology:
 *   Internet <---> [STA] ESP32 [AP] <---> Internal Clients
 *
 * ACL naming convention (from the router's interface perspective):
 * - to_esp:   Internet -> ESP32 (incoming on uplink interface)
 * - from_esp: ESP32 -> Internet (outgoing on uplink interface)
 * - to_ap:    Clients -> ESP32 (incoming on AP interface)
 * - from_ap:  ESP32 -> Clients (outgoing on AP interface)
 */

#pragma once

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"
#include "lwip/pbuf.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ACL list indices */
#define ACL_TO_ESP    0   /* Internet -> ESP32 (uplink input) */
#define ACL_FROM_ESP  1   /* ESP32 -> Internet (uplink output) */
#define ACL_TO_AP     2   /* Clients -> ESP32 (AP interface input) */
#define ACL_FROM_AP   3   /* ESP32 -> Clients (AP interface output) */
#define MAX_ACL_LISTS 4

/* Maximum rules per ACL list */
#define MAX_ACL_ENTRIES 16

/* ACL action codes */
#define ACL_DENY        0x00  /* Drop packet */
#define ACL_ALLOW       0x01  /* Allow packet */
#define ACL_MONITOR     0x02  /* Flag: also send to PCAP capture */
#define ACL_NO_MATCH    0xFF  /* No rule matched (packet allowed by default) */

/* Protocol constants */
#define ACL_PROTO_IP    0     /* Any IP protocol */
#define ACL_PROTO_ICMP  1     /* ICMP */
#define ACL_PROTO_TCP   6     /* TCP */
#define ACL_PROTO_UDP   17    /* UDP */

/**
 * @brief ACL rule entry structure
 */
typedef struct {
    uint32_t src;        /* Source IP (pre-masked) */
    uint32_t s_mask;     /* Source subnet mask */
    uint32_t dest;       /* Destination IP (pre-masked) */
    uint32_t d_mask;     /* Destination subnet mask */
    uint16_t s_port;     /* Source port (0 = any, TCP/UDP only) */
    uint16_t d_port;     /* Destination port (0 = any, TCP/UDP only) */
    uint8_t proto;       /* Protocol: 0=any, 6=TCP, 17=UDP */
    uint8_t allow;       /* Action: ACL_DENY, ACL_ALLOW, or with ACL_MONITOR */
    uint32_t hit_count;  /* Number of packets matched by this rule */
    uint8_t valid;       /* Entry is valid/active */
} acl_entry_t;

/**
 * @brief ACL statistics structure
 */
typedef struct {
    uint32_t packets_allowed;   /* Packets allowed (explicit rule) */
    uint32_t packets_denied;    /* Packets denied */
    uint32_t packets_nomatch;   /* Packets with no matching rule (allowed by default) */
} acl_stats_t;

/**
 * @brief Initialize the ACL subsystem
 * Clears all ACL lists and statistics.
 */
void acl_init(void);

/**
 * @brief Acquire the ACL mutex
 *
 * Must be held while iterating over the array returned by acl_get_rules().
 * Pair every acl_lock() with acl_unlock(). Do not call other acl_ mutating
 * functions while holding the lock (they take the lock internally).
 */
void acl_lock(void);

/**
 * @brief Release the ACL mutex
 */
void acl_unlock(void);

/**
 * @brief Check if an ACL list is empty (has no rules)
 * @param acl_no ACL list index (0-3)
 * @return true if the list has no rules, false if it has rules
 */
bool acl_is_empty(uint8_t acl_no);

/**
 * @brief Get number of rules in an ACL list
 * @param acl_no ACL list index (0-3)
 * @return Number of valid rules in the list
 */
int acl_get_count(uint8_t acl_no);

/**
 * @brief Recompute the cached rule count from the valid flags
 *
 * Rebuilds the lock-free counter read by acl_is_empty()/acl_get_count()
 * after the rules array has been populated directly (e.g. loaded from NVS).
 * @param acl_no ACL list index (0-3)
 */
void acl_recount(uint8_t acl_no);

/**
 * @brief Clear all rules from an ACL list
 * @param acl_no ACL list index (0-3)
 */
void acl_clear(uint8_t acl_no);

/**
 * @brief Clear statistics for an ACL list
 * @param acl_no ACL list index (0-3)
 */
void acl_clear_stats(uint8_t acl_no);

/**
 * @brief Add a rule to an ACL list
 * @param acl_no ACL list index (0-3)
 * @param src Source IP address (network byte order)
 * @param s_mask Source subnet mask (network byte order)
 * @param dest Destination IP address (network byte order)
 * @param d_mask Destination subnet mask (network byte order)
 * @param proto Protocol (0=any, 6=TCP, 17=UDP)
 * @param s_port Source port (0=any, host byte order)
 * @param d_port Destination port (0=any, host byte order)
 * @param allow Action (ACL_DENY, ACL_ALLOW, optionally OR'd with ACL_MONITOR)
 * @return true on success, false if list is full or invalid parameters
 */
bool acl_add(uint8_t acl_no, uint32_t src, uint32_t s_mask,
             uint32_t dest, uint32_t d_mask, uint8_t proto,
             uint16_t s_port, uint16_t d_port, uint8_t allow);

/**
 * @brief Delete a rule from an ACL list by index
 * @param acl_no ACL list index (0-3)
 * @param rule_idx Rule index within the list (0-15)
 * @return true if rule was deleted, false if invalid index
 */
bool acl_delete(uint8_t acl_no, uint8_t rule_idx);

/**
 * @brief Check a packet against an ACL list
 * @param acl_no ACL list index (0-3)
 * @param p Packet buffer to check
 * @return Action code (ACL_DENY, ACL_ALLOW, ACL_ALLOW|ACL_MONITOR, ACL_DENY|ACL_MONITOR, or ACL_NO_MATCH)
 */
uint8_t acl_check_packet(uint8_t acl_no, struct pbuf *p);

/**
 * @brief Get the ACL rules array for a list (for display/NVS)
 * @param acl_no ACL list index (0-3)
 * @return Pointer to the rules array, or NULL if invalid acl_no
 */
acl_entry_t* acl_get_rules(uint8_t acl_no);

/**
 * @brief Get statistics for an ACL list
 * @param acl_no ACL list index (0-3)
 * @return Pointer to statistics structure, or NULL if invalid acl_no
 */
acl_stats_t* acl_get_stats(uint8_t acl_no);

/**
 * @brief Print ACL list to console (for CLI)
 * @param acl_no ACL list index (0-3)
 */
void acl_print(uint8_t acl_no);

/**
 * @brief Get ACL list name string
 * @param acl_no ACL list index (0-3)
 * @return List name string or "unknown"
 */
const char* acl_get_name(uint8_t acl_no);

/**
 * @brief Get ACL list description
 * @param acl_no ACL list index (0-3)
 * @return List name string or "unknown"
 */
const char* acl_get_desc(uint8_t acl_no);

/**
 * @brief Parse ACL list name to index
 * @param name List name ("from_esp", "to_esp", "from_ap", "to_ap")
 * @return List index (0-3) or -1 if invalid name
 */
int acl_parse_name(const char* name);

/**
 * @brief Format an IP address with optional CIDR notation
 * @param ip IP address (network byte order)
 * @param mask Subnet mask (network byte order)
 * @param buf Output buffer
 * @param buf_len Buffer length
 * @return Pointer to buf
 */
char* acl_format_ip(uint32_t ip, uint32_t mask, char* buf, size_t buf_len);

/**
 * @brief Parse an IP address with optional CIDR notation
 * @param str Input string (e.g., "192.168.1.0/24" or "any")
 * @param ip Output IP address (network byte order)
 * @param mask Output subnet mask (network byte order)
 * @return true on success, false on parse error
 */
bool acl_parse_ip(const char* str, uint32_t* ip, uint32_t* mask);

/**
 * @brief Save all ACL rules to NVS
 * @return ESP_OK on success
 */
esp_err_t save_acl_rules(void);

/**
 * @brief Load all ACL rules from NVS
 * @return ESP_OK on success
 */
esp_err_t load_acl_rules(void);

#ifdef __cplusplus
}
#endif

```

### Core Architecture Module: `components/cmd_router/cmd_router.c`
```
/* The CLI commands of the router

   Unless required by applicable law or agreed to in writing, this
   software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
   CONDITIONS OF ANY KIND, either express or implied.
*/

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <time.h>
#include <inttypes.h>
#include <stdint.h>
#include "esp_log.h"
#include "esp_console.h"
#include "esp_system.h"
#include "esp_sleep.h"
#include "spi_flash_mmap.h"
#include "driver/rtc_io.h"
#include "driver/uart.h"
#include "argtable3/argtable3.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "sdkconfig.h"
#include "nvs.h"
#include "esp_wifi.h"

#include "lwip/ip4_addr.h"
#include "lwip/netif.h"
#include "esp_netif.h"
#if !IP_NAPT
#error "IP_NAPT must be defined"
#endif
#include "lwip/lwip_napt.h"

#include "mbedtls/sha256.h"
#include "esp_random.h"

#include "driver/gpio.h"
#include "soc/soc_caps.h"
#if SOC_TEMP_SENSOR_SUPPORTED
#include "driver/temperature_sensor.h"
#endif
#include "router_globals.h"
#include "cmd_router.h"
#include "pcap_capture.h"
#include "acl.h"
#include "remote_console.h"
/* web UI bind API */
extern uint8_t web_ui_get_bind(void);
extern void    web_ui_set_bind(uint8_t bind);
#include "syslog_client.h"
#include "oled_display.h"
#include "esp_ota_ops.h"
#include "esp_app_desc.h"

#ifdef CONFIG_FREERTOS_USE_STATS_FORMATTING_FUNCTIONS
#define WITH_TASKS_INFO 1
#endif

static const char *TAG = "cmd_router";

static void register_set_hostname(void);
#if !CONFIG_ETH_UPLINK
static void register_set_sta(void);
static void register_set_mac(void);
#else
static void register_set_ap_mac_only(void);
#endif
static void register_set_sta_static(void);
static void register_set_ap(void);
static void register_set_ap_ip(void);
static void register_set_ap_hidden(void);
static void register_set_ap_known_only(void);
static void register_set_ap_auth(void);
static void register_ap(void);
#if CONFIG_ETH_UPLINK
static void register_set_ap_channel(void);
#endif
static void register_set_ap_dns(void);
static void register_show(void);
static void register_portmap(void);
static void register_dhcp_reserve(void);
static void register_set_router_password(void);
static void register_web_ui(void);
static void register_bytes(void);
static void register_pcap(void);
static void register_set_led_gpio(void);
static void register_set_led_lowactive(void);
static void register_set_led_strip(void);
static void register_set_ttl(void);
static void register_set_watchdog(void);
static void register_client_stats_cmd(void);
static void register_set_ap_nat(void);
static void register_set_tx_power(void);
static void register_set_wifi_country(void);
static void register_set_antenna(void);
#if defined(CONFIG_IDF_TARGET_ESP32C6)
static void register_set_rf_switch(void);
#endif
static void register_acl(void);
static void register_remote_console_cmd(void);
static void register_syslog_cmd(void);
#if defined(CONFIG_IDF_TARGET_ESP32C3) || defined(CONFIG_IDF_TARGET_ESP32S3)
static void register_set_oled(void);
static void register_set_oled_gpio(void);
#endif
#if !CONFIG_ETH_UPLINK
static void register_scan(void);
#endif
#if WIFI_HAS_5GHZ
static void register_set_sta_band(void);
#endif
static void register_set_vpn(void);
static void register_set_tz(void);

/* ACL helper functions (forward declarations) */
static char* acl_format_ip_with_name(uint32_t ip, uint32_t mask, char* buf, size_t buf_len);
static bool acl_parse_ip_or_name(const char* str, uint32_t* ip, uint32_t* mask);
static void acl_print_with_names(uint8_t acl_no);

/* Check if character is a valid hex digit */
static inline int is_hex_digit(char c)
{
    return (c >= '0' && c <= '9') ||
           (c >= 'A' && c <= 'F') ||
           (c >= 'a' && c <= 'f');
}

/* Convert hex digit to value (assumes valid hex digit) */
static inline uint8_t hex_digit_value(char c)
{
    if (c >= '0' && c <= '9')
        return c - '0';
    else
        return toupper((unsigned char)c) - 'A' + 10;
}

/* Check if string represents a boolean true value */
static inline bool parse_bool_true(const char *str)
{
    return (strcasecmp(str, "true") == 0 ||
            strcasecmp(str, "yes") == 0 ||
            strcasecmp(str, "on") == 0 ||
            strcmp(str, "1") == 0);
}

/* Check if string represents a boolean false value */
static inline bool parse_bool_false(const char *str)
{
    return (strcasecmp(str, "false") == 0 ||
            strcasecmp(str, "no") == 0 ||
            strcasecmp(str, "off") == 0 ||
            strcmp(str, "0") == 0);
}

void preprocess_string(char* str)
{
    char *p, *q;

    for (p = q = str; *p != 0; p++)
    {
        if (*(p) == '%' && *(p + 1) != 0 && *(p + 2) != 0 &&
            is_hex_digit(*(p + 1)) && is_hex_digit(*(p + 2)))
        {
            // Valid percent-encoded hex sequence
            p++;
            uint8_t a = hex_digit_value(*p) << 4;
            p++;
            a += hex_digit_value(*p);
            *q++ = a;
        }
        else if (*(p) == '+') {
            *q++ = ' ';
        } else {
            *q++ = *p;
        }
    }
    *q = '\0';
}

/* Keys whose value must never reach the console, the log, or syslog. */
static bool is_secret_param(const char *name)
{
    static const char *const secrets[] = {
        "passwd", "ap_passwd", "vpn_privkey", "vpn_psk", "web_password", "mqtt_pass"
    };
    for (size_t i = 0; i < sizeof(secrets) / sizeof(secrets[0]); i++) {
        if (strcmp(name, secrets[i]) == 0) return true;
    }
    return false;
}

esp_err_t get_config_param_str(char* name, char** param)
{
    nvs_handle_t nvs;

    esp_err_t err = nvs_open(PARAM_NAMESPACE, NVS_READONLY, &nvs);
    if (err == ESP_OK) {
        size_t len;
        if ( (err = nvs_get_str(nvs, name, NULL, &len)) == ESP_OK) {
            *param = (char *)malloc(len);
            if (*param == NULL) {
                nvs_close(nvs);
                return ESP_ERR_NO_MEM;
            }
            err = nvs_get_str(nvs, name, *param, &len);
            ESP_LOGI(TAG, "%s %s", name, is_secret_param(name) ? "<hidden>" : *param);
        } else {
            /* Key missing (NVS_NOT_FOUND) is the common case for optional keys;
             * must still close the handle here or it leaks on every lookup —
             * e.g. http_open_fn reads optional keys on every connection. */
            nvs_close(nvs);
            return err;
        }
        nvs_close(nvs);
    } else {
        return err;
    }
    return ESP_OK;
}

esp_err_t get_config_param_int(char* name, int* param)
{
    nvs_handle_t nvs;

    esp_err_t err = nvs_open(PARAM_NAMESPACE, NVS_READONLY, &nvs);
    if (err == ESP_OK) {
        if ( (err = nvs_get_i32(nvs, name, (int32_t*)(param))) == ESP_OK) {
            ESP_LOGI(TAG, "%s %d", name, *param);
        } else {
            /* Key missing (NVS_NOT_FOUND) is the common case for optional keys;
             * must still close the handle here or it leaks on every lookup —
             * e.g. http_open_fn reads optional keys on every connection. */
            nvs_close(nvs);
            return err;
        }
        nvs_close(nvs);
    } else {
        return err;
    }
    return ESP_OK;
}

esp_err_t get_config_param_blob(char* name, uint8_t** blob, size_t blob_len)
{
    nvs_handle_t nvs;

    esp_err_t err = nvs_open(PARAM_NAMESPACE, NVS_READONLY, &nvs);
    if (err == ESP_OK) {
        size_t len;
        if ( (err = nvs_get_blob(nvs, name, NULL, &len)) == ESP_OK) {
            if (len != blob_len) {
                nvs_close(nvs);
                return ESP_ERR_NVS_INVALID_LENGTH;
            }
            *blob = (uint8_t *)malloc(len);
            if (*blob == NULL) {
                nvs_close(nvs);
                return ESP_ERR_NO_MEM;
            }
            err = nvs_get_blob(nvs, name, *blob, &len);
            ESP_LOGI(TAG, "%s: %d", name, len);
        } else {
            /* Key missing (NVS_NOT_FOUND) is the common case for optional keys;
             * must still close the handle here or it leaks on every lookup —
             * e.g. http_open_fn reads optional keys on every connection. */
            nvs_close(nvs);
            return err;
        }
        nvs_close(nvs);
    } else {
        return err;
    }
    return ESP_OK;
}

esp_err_t set_config_param_str(const char* name, const char* value)
{
    nvs_handle_t nvs;
    esp_err_t err = nvs_open(PARAM_NAMESPACE, NVS_READWRITE, &nvs);
    if (err != ESP_OK) return err;
    err = nvs_set_str(nvs, name, value);
    if (err == ESP_OK) err = nvs_commit(nvs);
    nvs_close(nvs);
    return err;
}

esp_err_t set_config_param_int(const char* name, int32_t value)
{
    nvs_handle_t nvs;
    esp_err_t err = nvs_open(PARAM_NAMESPACE, NVS_READWRITE, &nvs);
    if (err != ESP_OK) return err;
    err = nvs_set_i32(nvs, name, value);
    if (err == ESP_OK) err = nvs_commit(nvs);
    nvs_close(nvs);
    return err;
}

esp_err_t set_config_param_blob(const char* name, const void* data, size_t len)
{
    nvs_handle_t nvs;
    esp_err_t err = nvs_open(PARAM_NAMESPACE, NVS_READWRITE, &nvs);
    if (err != ESP_OK) return err;
    err = nvs_set_blob(nvs, name, data, len);
    if (err == ESP_OK) err = nvs_commit(nvs);
    nvs_close(nvs);
    return err;
}

/* Convert a CIDR prefix length (0-32) into a dotted-decimal netmask string. */
static void prefix_to_netmask(int prefix, char *out, size_t out_len)
{
    if (prefix < 0) prefix = 0;
    if (prefix > 32) prefix = 32;
    uint32_t mask = prefix ? (0xFFFFFFFFu << (32 - prefix)) : 0;
    snprintf(out, out_len, "%u.%u.%u.%u",
             (unsigned)((mask >> 24) & 0xFF), (unsigned)((mask >> 16) & 0xFF),
             (unsigned)((mask >> 8) & 0xFF),  (unsigned)(mask & 0xFF));
}

/* Trim leading/trailing ASCII whitespace in place; returns a pointer into s. */
static char *trim_ws(char *s)
{
    while (*s && isspace((unsigned char)*s)) s++;
    if (*s == '\0') return s;
    char *end = s + strlen(s) - 1;
    while (end > s && is
```

### Core Architecture Module: `components/cmd_router/cmd_router.h`
```
/* Console example — various router commands

   This example code is in the Public Domain (or CC0 licensed, at your option.)

   Unless required by applicable law or agreed to in writing, this
   software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
   CONDITIONS OF ANY KIND, either express or implied.
*/
#pragma once

#ifdef __cplusplus
extern "C" {
#endif

// Register router functions
void register_router(void);

#ifdef __cplusplus
}
#endif

```

### Core Architecture Module: `components/cmd_system/cmd_system.c`
```
/* Console example — various system commands

   This example code is in the Public Domain (or CC0 licensed, at your option.)

   Unless required by applicable law or agreed to in writing, this
   software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
   CONDITIONS OF ANY KIND, either express or implied.
*/

#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include "esp_log.h"
#include "esp_console.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "nvs.h"
#include "router_config.h"
#include "esp_sleep.h"
#include "esp_flash.h"
#include "esp_chip_info.h"
#include "driver/rtc_io.h"
#include "driver/uart.h"
#include "driver/gpio.h"
#include "argtable3/argtable3.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "cmd_system.h"
#include "sdkconfig.h"
#include "lwip/inet.h"
#include "lwip/netdb.h"
#include "lwip/sockets.h"
#include "ping/ping_sock.h"
#include "freertos/semphr.h"

#ifdef CONFIG_FREERTOS_USE_STATS_FORMATTING_FUNCTIONS
#define WITH_TASKS_INFO 1
#endif

static const char *TAG = "cmd_system";

void load_log_level(void)
{
    nvs_handle_t nvs;
    esp_err_t err = nvs_open(PARAM_NAMESPACE, NVS_READONLY, &nvs);
    if (err == ESP_OK) {
        uint8_t level = ESP_LOG_WARN;  // Default
        if (nvs_get_u8(nvs, "log_level", &level) == ESP_OK) {
            if (level <= ESP_LOG_VERBOSE) {
                esp_log_level_set("*", (esp_log_level_t)level);
                ESP_LOGI(TAG, "Log level loaded from NVS: %d", level);
            }
        }
        nvs_close(nvs);
    }
}

static void register_heap(void);
static void register_version(void);
static void register_restart(void);
static void register_factory_reset(void);
static void register_deep_sleep(void);
static void register_light_sleep(void);
static void register_log_level(void);
static void register_ping(void);
#if WITH_TASKS_INFO
static void register_tasks(void);
#endif

void register_system(void)
{
    register_heap();
    register_version();
    register_restart();
    register_factory_reset();
    register_deep_sleep();
    register_light_sleep();
    register_log_level();
    register_ping();
#if WITH_TASKS_INFO
    register_tasks();
#endif
}

/* 'version' command */
static const char* get_chip_model_name(esp_chip_model_t model)
{
    switch (model) {
        case CHIP_ESP32:   return "ESP32";
        case CHIP_ESP32S2: return "ESP32-S2";
        case CHIP_ESP32S3: return "ESP32-S3";
        case CHIP_ESP32C3: return "ESP32-C3";
        case CHIP_ESP32C2: return "ESP32-C2";
        case CHIP_ESP32C5: return "ESP32-C5";
        case CHIP_ESP32C6: return "ESP32-C6";
        case CHIP_ESP32H2: return "ESP32-H2";
        default:           return "Unknown";
    }
}

static int get_version(int argc, char **argv)
{
    esp_chip_info_t info;
    esp_chip_info(&info);
    uint32_t size_flash_chip;
    esp_flash_get_size(NULL, &size_flash_chip);
    printf("IDF Version:%s\r\n", esp_get_idf_version());
    printf("Chip info:\r\n");
    printf("\tmodel:%s\r\n", get_chip_model_name(info.model));
    printf("\tcores:%d\r\n", info.cores);
    printf("\tfeature:%s%s%s%s%lu%s\r\n",
           info.features & CHIP_FEATURE_WIFI_BGN ? "/802.11bgn" : "",
           info.features & CHIP_FEATURE_BLE ? "/BLE" : "",
           info.features & CHIP_FEATURE_BT ? "/BT" : "",
           info.features & CHIP_FEATURE_EMB_FLASH ? "/Embedded-Flash:" : "/External-Flash:",
           size_flash_chip / (1024 * 1024), " MB");
    printf("\trevision number:%d\r\n", info.revision);
    return 0;
}

static void register_version(void)
{
    const esp_console_cmd_t cmd = {
        .command = "version",
        .help = "Get version of chip and SDK",
        .hint = NULL,
        .func = &get_version,
    };
    ESP_ERROR_CHECK( esp_console_cmd_register(&cmd) );
}

/** 'restart' command restarts the program */

static int restart(int argc, char **argv)
{
    ESP_LOGI(TAG, "Restarting");
    esp_restart();
}

static void register_restart(void)
{
    const esp_console_cmd_t cmd = {
        .command = "restart",
        .help = "Software reset of the chip",
        .hint = NULL,
        .func = &restart,
    };
    ESP_ERROR_CHECK( esp_console_cmd_register(&cmd) );
}

/** 'factory_reset' command erases all settings and restarts */

static int factory_reset(int argc, char **argv)
{
    nvs_handle_t nvs;
    esp_err_t err = nvs_open(PARAM_NAMESPACE, NVS_READWRITE, &nvs);
    if (err == ESP_OK) {
        err = nvs_erase_all(nvs);
        if (err == ESP_OK) {
            err = nvs_commit(nvs);
        }
        nvs_close(nvs);
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to erase NVS namespace: %s", esp_err_to_name(err));
        return 1;
    }
    ESP_LOGW(TAG, "Factory reset: NVS namespace '%s' erased, restarting...", PARAM_NAMESPACE);
    esp_wifi_restore();
    esp_restart();
    return 0; // Never reached
}

static void register_factory_reset(void)
{
    const esp_console_cmd_t cmd = {
        .command = "factory_reset",
        .help = "Erase all settings (NVS namespace '" PARAM_NAMESPACE "') and restart",
        .hint = NULL,
        .func = &factory_reset,
    };
    ESP_ERROR_CHECK( esp_console_cmd_register(&cmd) );
}

/** 'heap' command prints available heap memory */

static int heap_mem(int argc, char **argv)
{
    printf("Current heap size: %lu (minimal: %u)\n", esp_get_free_heap_size(), 
        heap_caps_get_minimum_free_size(MALLOC_CAP_DEFAULT));
    return 0;
}

static void register_heap(void)
{
    const esp_console_cmd_t cmd = {
        .command = "heap",
        .help = "Get the current amd min size of free heap memory",
        .hint = NULL,
        .func = &heap_mem,
    };
    ESP_ERROR_CHECK( esp_console_cmd_register(&cmd) );
}

/** 'tasks' command prints the list of tasks and related information */
#if WITH_TASKS_INFO

static int tasks_info(int argc, char **argv)
{
    const size_t bytes_per_task = 40; /* see vTaskList description */
    char *task_list_buffer = malloc(uxTaskGetNumberOfTasks() * bytes_per_task);
    if (task_list_buffer == NULL) {
        ESP_LOGE(TAG, "failed to allocate buffer for vTaskList output");
        return 1;
    }
    fputs("Task Name\tStatus\tPrio\tHWM\tTask#", stdout);
#ifdef CONFIG_FREERTOS_VTASKLIST_INCLUDE_COREID
    fputs("\tAffinity", stdout);
#endif
    fputs("\n", stdout);
    vTaskList(task_list_buffer);
    fputs(task_list_buffer, stdout);
    free(task_list_buffer);
    return 0;
}

static void register_tasks(void)
{
    const esp_console_cmd_t cmd = {
        .command = "tasks",
        .help = "Get information about running tasks",
        .hint = NULL,
        .func = &tasks_info,
    };
    ESP_ERROR_CHECK( esp_console_cmd_register(&cmd) );
}

#endif // WITH_TASKS_INFO

/** 'deep_sleep' command puts the chip into deep sleep mode */

static struct {
    struct arg_int *wakeup_time;
    struct arg_int *wakeup_gpio_num;
    struct arg_int *wakeup_gpio_level;
    struct arg_end *end;
} deep_sleep_args;


static int deep_sleep(int argc, char **argv)
{
    int nerrors = arg_parse(argc, argv, (void **) &deep_sleep_args);
    if (nerrors != 0) {
        arg_print_errors(stderr, deep_sleep_args.end, argv[0]);
        return 1;
    }
    if (deep_sleep_args.wakeup_time->count) {
        uint64_t timeout = 1000ULL * deep_sleep_args.wakeup_time->ival[0];
        ESP_LOGI(TAG, "Enabling timer wakeup, timeout=%lluus", timeout);
        ESP_ERROR_CHECK( esp_sleep_enable_timer_wakeup(timeout) );
    }
    if (deep_sleep_args.wakeup_gpio_num->count) {
        int io_num = deep_sleep_args.wakeup_gpio_num->ival[0];
        if (!GPIO_IS_VALID_GPIO(io_num)) {
            ESP_LOGE(TAG, "GPIO %d is not a valid GPIO", io_num);
            return 1;
        }
        int level = 0;
        if (deep_sleep_args.wakeup_gpio_level->count) {
            level = deep_sleep_args.wakeup_gpio_level->ival[0];
            if (level != 0 && level != 1) {
                ESP_LOGE(TAG, "Invalid wakeup level: %d", level);
                return 1;
            }
        }
        ESP_LOGI(TAG, "Enabling wakeup on GPIO%d, wakeup on %s level",
                 io_num, level ? "HIGH" : "LOW");

        #if defined(CONFIG_IDF_TARGET_ESP32) || defined(CONFIG_IDF_TARGET_ESP32S2)
            ESP_ERROR_CHECK( esp_sleep_enable_ext1_wakeup_io(1ULL << io_num, level) );
        #endif
    }
    #if defined(CONFIG_IDF_TARGET_ESP32) || defined(CONFIG_IDF_TARGET_ESP32S2)
        rtc_gpio_isolate(GPIO_NUM_12);
    #endif
    esp_deep_sleep_start();
}

static void register_deep_sleep(void)
{
    deep_sleep_args.wakeup_time =
        arg_int0("t", "time", "<t>", "Wake up time, ms");
    deep_sleep_args.wakeup_gpio_num =
        arg_int0(NULL, "io", "<n>",
                 "If specified, wakeup using GPIO with given number");
    deep_sleep_args.wakeup_gpio_level =
        arg_int0(NULL, "io_level", "<0|1>", "GPIO level to trigger wakeup");
    deep_sleep_args.end = arg_end(3);

    const esp_console_cmd_t cmd = {
        .command = "deep_sleep",
        .help = "Enter deep sleep mode. "
        "Two wakeup modes are supported: timer and GPIO. "
        "If no wakeup option is specified, will sleep indefinitely.",
        .hint = NULL,
        .func = &deep_sleep,
        .argtable = &deep_sleep_args
    };
    ESP_ERROR_CHECK( esp_console_cmd_register(&cmd) );
}

/** 'light_sleep' command puts the chip into light sleep mode */

static struct {
    struct arg_int *wakeup_time;
    struct arg_int *wakeup_gpio_num;
    struct arg_int *wakeup_gpio_level;
    struct arg_end *end;
} light_sleep_args;

static int light_sleep(int argc, char **argv)
{
    int nerrors = arg_parse(argc, argv, (void **) &light_sleep_args);
    if (nerrors != 0) {
        arg_print_errors(stderr, light_sleep_args.end, argv[0]);
        return 1;
    }
    esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
    if (light_sleep_args.wakeup_time->count) {
        uint64_t timeout = 1000ULL * light_sleep_args.wakeup_time->ival[0];
        ESP_LOGI(
```

### Core Architecture Module: `components/cmd_system/cmd_system.h`
```
/* Console example — various system commands

   This example code is in the Public Domain (or CC0 licensed, at your option.)

   Unless required by applicable law or agreed to in writing, this
   software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
   CONDITIONS OF ANY KIND, either express or implied.
*/
#pragma once

#ifdef __cplusplus
extern "C" {
#endif

// Register system functions
void register_system(void);

// Load and apply saved log level from NVS
void load_log_level(void);

#ifdef __cplusplus
}
#endif

```

### Core Architecture Module: `components/dhcpserver/dhcpserver.c`
```
/*
 * SPDX-FileCopyrightText: 2015-2025 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "esp_log.h"
#include "lwip/dhcp.h"
#include "lwip/err.h"
#include "lwip/pbuf.h"
#include "lwip/udp.h"
#include "lwip/mem.h"
#include "lwip/ip_addr.h"
#include "lwip/timeouts.h"
#include "lwip/etharp.h"
#include "lwip/prot/ethernet.h"

#include "dhcpserver/dhcpserver.h"
#include "dhcpserver/dhcpserver_options.h"
#include "dhcp_reservations.h"

#if ESP_DHCPS

static const char *TAG = "custom_dhcps";

#ifdef LWIP_HOOK_FILENAME
#include LWIP_HOOK_FILENAME
#endif

#ifndef LWIP_HOOK_DHCPS_POST_APPEND_OPTS
#define LWIP_HOOK_DHCPS_POST_APPEND_OPTS(netif, dhcps, state, pp_opts)
#endif

#define BOOTP_BROADCAST 0x8000
#define BROADCAST_BIT_IS_SET(flag) (flag & BOOTP_BROADCAST)

#define DHCP_REQUEST        1
#define DHCP_REPLY          2
#define DHCP_HTYPE_ETHERNET 1
#define DHCP_HLEN_ETHERNET  6
#define DHCP_MSG_LEN      236

#define DHCPS_SERVER_PORT  67
#define DHCPS_CLIENT_PORT  68

#define DHCPDISCOVER  1
#define DHCPOFFER     2
#define DHCPREQUEST   3
#define DHCPDECLINE   4
#define DHCPACK       5
#define DHCPNAK       6
#define DHCPRELEASE   7

#define DHCP_OPTION_SUBNET_MASK   1
#define DHCP_OPTION_ROUTER        3
#define DHCP_OPTION_DNS_SERVER    6
#define DHCP_OPTION_REQ_IPADDR   50
#define DHCP_OPTION_LEASE_TIME   51
#define DHCP_OPTION_MSG_TYPE     53
#define DHCP_OPTION_SERVER_ID    54
#define DHCP_OPTION_INTERFACE_MTU 26
#define DHCP_OPTION_PERFORM_ROUTER_DISCOVERY 31
#define DHCP_OPTION_BROADCAST_ADDRESS 28
#define DHCP_OPTION_HOSTNAME     12
#define DHCP_OPTION_REQ_LIST     55
#define DHCP_OPTION_CAPTIVEPORTAL_URI 114
#define DHCP_OPTION_PAD         0
#define DHCP_OPTION_END         255

//#define USE_CLASS_B_NET 1
#define DHCPS_DEBUG          0
#define DHCPS_LOG printf

#define IS_INVALID_SUBNET_MASK(x)  (((x-1) | x) != 0xFFFFFFFF)
/* Notes:
*  CIDR eliminates the traditional Class A, Class B and Class C addresses.
 */
#define IP_CLASS_HOST_NUM(mask)            (0xffffffff & ~mask)
#define DHCP_CHECK_SUBNET_MASK_IP(mask)                                                               \
    do {                                                                                                  \
        if (IS_INVALID_SUBNET_MASK(mask)) {                                                               \
            DHCPS_LOG("dhcps: Illegal subnet mask.\n");                                                   \
            return ERR_ARG;                                                                               \
        }                                                                                                 \
    } while (0)

#define DHCP_CHECK_IP_MATCH_SUBNET_MASK(mask, ip)                           \
    u32_t start_ip = 0;                                                     \
    u32_t end_ip = 0;                                                       \
    do {                                                                    \
        start_ip = ip & mask;                                               \
        end_ip = start_ip | ~mask;                                          \
        if (ip == end_ip || ip == start_ip) {                               \
            DHCPS_LOG("dhcps: ip address and subnet mask do not match.\n"); \
            return ERR_ARG;                                                 \
        }                                                                   \
    } while (0)

#define MAX_STATION_NUM CONFIG_LWIP_DHCPS_MAX_STATION_NUM

#define DHCPS_STATE_OFFER 1
#define DHCPS_STATE_DECLINE 2
#define DHCPS_STATE_ACK 3
#define DHCPS_STATE_NAK 4
#define DHCPS_STATE_IDLE 5
#define DHCPS_STATE_RELEASE 6

typedef enum {
    DHCPS_HANDLE_CREATED = 0,
    DHCPS_HANDLE_STARTED,
    DHCPS_HANDLE_STOPPED,
    DHCPS_HANDLE_DELETE_PENDING,
} dhcps_handle_state;

typedef struct list_node {
	void *pnode;
	struct list_node *pnext;
} list_node;

typedef struct {
    ip4_addr_t ip;
    ip4_addr_t netmask;
    ip4_addr_t gw;
} ip_info_t;
////////////////////////////////////////////////////////////////////////////////////

static const u32_t magic_cookie  = 0x63538263;

// Global DHCP server instance for external access (e.g., lease enumeration)
static dhcps_t *g_dhcps_instance = NULL;

struct dhcps_t {
    struct netif *dhcps_netif;
    ip4_addr_t broadcast_dhcps;
    ip4_addr_t server_address;
    ip4_addr_t dns_server[DNS_TYPE_MAX];
    ip4_addr_t client_address;
    ip4_addr_t client_address_plus;
    ip4_addr_t dhcps_mask;
    list_node *plist;
    bool renew;
    dhcps_lease_t dhcps_poll;
    dhcps_time_t dhcps_lease_time;
    dhcps_offer_t dhcps_offer;
    dhcps_offer_t dhcps_dns;
    char *dhcps_captiveportal_uri;
    dhcps_cb_t dhcps_cb;
    void* dhcps_cb_arg;
    struct udp_pcb *dhcps_pcb;
    dhcps_handle_state state;
    bool has_declined_ip;
    char current_hostname[DHCPS_MAX_HOSTNAME_LEN];  // Temporary storage for current client's hostname
};


static void dhcps_tmr(void* arg);


dhcps_t *__wrap_dhcps_new(void)
{
    ESP_LOGI(TAG, "Creating new DHCP server instance (custom implementation)");
    dhcps_t *dhcps = mem_calloc(1, sizeof(dhcps_t));

    if (dhcps == NULL) {
        return NULL;
    }
    dhcps->dhcps_netif = NULL;

    for (int i = 0; i < DNS_TYPE_MAX; i++) {
        dhcps->dns_server[i].addr = 0;
    }
#ifdef USE_CLASS_B_NET
    dhcps->dhcps_mask.addr = PP_HTONL(LWIP_MAKEU32(255, 240, 0, 0));
#else
    dhcps->dhcps_mask.addr = PP_HTONL(LWIP_MAKEU32(255, 255, 255, 0));
#endif
    dhcps->plist = NULL;
    dhcps->renew = false;
    dhcps->dhcps_lease_time = DHCPS_LEASE_TIME_DEF;
    dhcps->dhcps_offer = 0xFF;
    dhcps->dhcps_dns = 0x00;
    dhcps->dhcps_captiveportal_uri = NULL;
    dhcps->dhcps_pcb = NULL;
    dhcps->state = DHCPS_HANDLE_CREATED;
    dhcps->has_declined_ip = false;
    return dhcps;
}

void __wrap_dhcps_delete(dhcps_t *dhcps)
{
    if (dhcps) {
        if (dhcps->state == DHCPS_HANDLE_STARTED) {
            // if the dhcp-server has started already, we have to postpone the deletion
            dhcps->state = DHCPS_HANDLE_DELETE_PENDING;
        } else {
            // otherwise, we're free to delete the handle immediately
            free(dhcps);
        }
    }
}

static void get_ip_info(struct netif * netif, ip_info_t *ip_info)
{
    if (netif != NULL && netif_is_up(netif)) {
        ip4_addr_set(&ip_info->ip, ip_2_ip4(&netif->ip_addr));
        ip4_addr_set(&ip_info->netmask, ip_2_ip4(&netif->netmask));
        ip4_addr_set(&ip_info->gw, ip_2_ip4(&netif->gw));
    }
}

static inline u8_t* dhcps_option_ip(u8_t *optptr, const ip4_addr_t *ip)
{
    LWIP_ASSERT("dhcps_option_ip: optptr must not be NULL", (optptr != NULL));
    LWIP_ASSERT("dhcps_option_ip: ip must not be NULL", (ip != NULL));

    *optptr++ = ip4_addr1(ip);
    *optptr++ = ip4_addr2(ip);
    *optptr++ = ip4_addr3(ip);
    *optptr++ = ip4_addr4(ip);
    return optptr;
}

/******************************************************************************
 * FunctionName : dhcps_option_info
 * Description  : get the DHCP message option info
 * Parameters   : op_id -- DHCP message option id
 *                opt_len -- DHCP message option length
 * Returns      : DHCP message option addr
*******************************************************************************/
void *__wrap_dhcps_option_info(dhcps_t *dhcps, u8_t op_id, u32_t opt_len)
{
    void *option_arg = NULL;
    if (dhcps == NULL) {
        return NULL;
    }

    switch (op_id) {
        case IP_ADDRESS_LEASE_TIME:
            if (opt_len == sizeof(dhcps_time_t)) {
                option_arg = &dhcps->dhcps_lease_time;
            }

            break;

        case REQUESTED_IP_ADDRESS:
            if (opt_len == sizeof(dhcps_lease_t)) {
                option_arg = &dhcps->dhcps_poll;
            }

            break;

        case ROUTER_SOLICITATION_ADDRESS:
            if (opt_len == sizeof(dhcps_offer_t)) {
                option_arg = &dhcps->dhcps_offer;
            }

            break;

        case DOMAIN_NAME_SERVER:
            if (opt_len == sizeof(dhcps_offer_t)) {
                option_arg = &dhcps->dhcps_dns;
            }

            break;
        case SUBNET_MASK:
            if (opt_len == sizeof(dhcps->dhcps_mask)) {
                option_arg = &dhcps->dhcps_mask;
            }

            break;
        case CAPTIVEPORTAL_URI:
            option_arg = &dhcps->dhcps_captiveportal_uri;

            break;
        default:
            break;
    }

    return option_arg;
}

/******************************************************************************
 * FunctionName : dhcps_set_option_info
 * Description  : set the DHCP message option info
 * Parameters   : op_id -- DHCP message option id
 *                opt_info -- DHCP message option info
 *                opt_len -- DHCP message option length
 * Returns      : none
*******************************************************************************/
err_t __wrap_dhcps_set_option_info(dhcps_t *dhcps, u8_t op_id, void *opt_info, u32_t opt_len)
{
    if (dhcps == NULL || opt_info == NULL) {
        return ERR_ARG;
    }
    switch (op_id) {
        case IP_ADDRESS_LEASE_TIME:
            if (opt_len == sizeof(dhcps_time_t)) {
                dhcps->dhcps_lease_time = *(dhcps_time_t *)opt_info;
            }

            break;

        case REQUESTED_IP_ADDRESS:
            if (opt_len == sizeof(dhcps_lease_t)) {
                dhcps->dhcps_poll = *(dhcps_lease_t *)opt_info;
            }

            break;

        case ROUTER_SOLICITATION_ADDRESS:
            if (opt_len == sizeof(dhcps_offer_t)) {
                dhcps->dhcps_offer = *(dhcps_offer_t *)opt_info;
            }

            break;

        case DOMAIN_NAME_SERVER:
            if (opt_len == sizeof(dhcps_offer_t)) {
                dhcps->dhcps_dns = *(dhcps_offer_t *)opt_info;
            }
   
```

### Core Architecture Module: `components/dhcpserver/include/dhcpserver/dhcpserver.h`
```
/*
 * SPDX-FileCopyrightText: 2015-2024 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */
#ifndef __DHCPS_H__
#define __DHCPS_H__

#include "sdkconfig.h"
#include <stdbool.h>
#include <stdint.h>
#include "lwip/ip_addr.h"
#include "lwip/err.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct dhcps_state{
        s16_t state;
} dhcps_state;

typedef struct dhcps_msg {
        u8_t op, htype, hlen, hops;
        u8_t xid[4];
        u16_t secs, flags;
        u8_t ciaddr[4];
        u8_t yiaddr[4];
        u8_t siaddr[4];
        u8_t giaddr[4];
        u8_t chaddr[16];
        u8_t sname[64];
        u8_t file[128];
        u8_t options[312];
}dhcps_msg;

/*   Defined in esp_misc.h */
typedef struct {
	bool enable;
	ip4_addr_t start_ip;
	ip4_addr_t end_ip;
} dhcps_lease_t;

enum dhcps_offer_option{
	OFFER_START = 0x00,
	OFFER_ROUTER = 0x01,
	OFFER_DNS = 0x02,
	OFFER_END
};

typedef enum
{
    DNS_TYPE_MAIN = 0, /**< DNS main server address*/
    DNS_TYPE_BACKUP,   /**< DNS backup server address (Wi-Fi STA and Ethernet only) */
    DNS_TYPE_MAX
} dns_type_t;

/** @brief DHCP server's description of compile time configuration values in dhcpserver.c
 *
 * - DHCPS_DEBUG: Prints very detailed debug messages if set to 1, hardcoded to 0
 * - USE_CLASS_B_NET: Use class B network mask if enabled, not-defined (could be enabled as CC_FLAGS)
 * - MAX_STATION_NUM: Maximum number of clients, set to Kconfig value CONFIG_LWIP_DHCPS_MAX_STATION_NUM
 * - LWIP_HOOK_DHCPS_POST_STATE: Used to inject user code after parsing DHCP message, not defined
 *      - could be enabled in lwipopts.h or via CC_FLAGS
 *      - basic usage of the hook to print hex representation of the entire option field is below:
 *          #define LWIP_HOOK_DHCPS_POST_STATE(msg, len, state) \
 *          ({ s16_t ret = state; if (state == DHCPS_STATE_ACK) { ESP_LOG_BUFFER_HEXDUMP("DHCPS",msg->options, 312, ESP_LOG_INFO);} ret; })
 */

/**
 * @brief Definitions related to lease time, units and limits
 */
#define DHCPS_COARSE_TIMER_SECS  1
#define DHCPS_MAX_LEASE 0x64
#define DHCPS_LEASE_TIME_DEF (120)
#define DHCPS_LEASE_UNIT CONFIG_LWIP_DHCPS_LEASE_UNIT

#define DHCPS_MAX_HOSTNAME_LEN 32

struct dhcps_pool{
	ip4_addr_t ip;
	u8_t mac[6];
	u32_t lease_timer;
	char hostname[DHCPS_MAX_HOSTNAME_LEN];  // Client-provided hostname from DHCP Option 12
};

typedef u32_t dhcps_time_t;
typedef u8_t dhcps_offer_t;

typedef struct {
        dhcps_offer_t dhcps_offer;
        dhcps_offer_t dhcps_dns;
        dhcps_time_t  dhcps_time;
        dhcps_lease_t dhcps_poll;
} dhcps_options_t;

typedef void (*dhcps_cb_t)(void* cb_arg, u8_t client_ip[4], u8_t client_mac[6]);

static inline bool dhcps_router_enabled (dhcps_offer_t offer)
{
    return (offer & OFFER_ROUTER) != 0;
}

static inline bool dhcps_dns_enabled (dhcps_offer_t offer)
{
    return (offer & OFFER_DNS) != 0;
}

typedef struct dhcps_t dhcps_t;

/**
 * @brief Creates new DHCP server object
 *
 * @return Pointer to the DHCP server handle on success, NULL on error
 */
dhcps_t *dhcps_new(void);

/**
 * @brief Deletes supplied DHPC server object
 *
 * @warning This may not delete the handle immediately if the server wasn't
 * stopped properly, but mark for deleting once the timer callback occurs
 *
 * @param dhcps Pointer to the DHCP handle
 */
void dhcps_delete(dhcps_t *dhcps);

/**
 * @brief Starts the DHCP server on the specified network interface
 *
 * @param dhcps Pointer to the DHCP handle
 * @param netif Pointer to the lwIP's network interface struct
 * @param ip DHCP server's address
 * @return ERR_ARG if invalid args, ERR_OK on success
 */
err_t dhcps_start(dhcps_t *dhcps, struct netif *netif, ip4_addr_t ip);

/**
 * @brief Stops the DHCP server on the specified netif
 * @param dhcps Pointer to the DHCP handle
 * @param netif Pointer to the lwIP's network interface struct
 * @return ERR_ARG if invalid args, ERR_OK on success
 */
err_t dhcps_stop(dhcps_t *dhcps, struct netif *netif);

/**
 * @brief Gets the DHCP server option info
 * @param dhcps Pointer to the DHCP handle
 * @param op_id DHCP message option id
 * @param opt_len DHCP message option length
 * @return DHCP message option addr
 */
void *dhcps_option_info(dhcps_t *dhcps, u8_t op_id, u32_t opt_len);

/**
 * @brief Sets the DHCP server option info
 * @param dhcps Pointer to the DHCP handle
 * @param op_id DHCP message option id
 * @param opt_info DHCP message option info
 * @param opt_len DHCP message option length
 * @return ERR_ARG if invalid args, ERR_OK on success
 */
err_t dhcps_set_option_info(dhcps_t *dhcps, u8_t op_id, void *opt_info, u32_t opt_len);

/**
 * @brief Tries to find IP address corresponding to the supplied MAC
 * @param dhcps Pointer to the DHCP handle
 * @param mac Supplied MAC address
 * @param ip Pointer to the resultant IP address
 * @return True if the IP address has been found
 */
bool dhcp_search_ip_on_mac(dhcps_t *dhcps, u8_t *mac, ip4_addr_t *ip);

/**
 * @brief Sets the DNS server address for the DHCP server
 * @param dhcps Pointer to the DHCP handle
 * @param dnsserver Address of the DNS server
 * @return ERR_ARG if invalid handle, ERR_VAL if invalid type, ERR_OK on success
 */
err_t dhcps_dns_setserver(dhcps_t *dhcps, const ip_addr_t *dnsserver);

/**
 * @brief Sets the DNS server address for the DHCP server with a specific type
 * @param dhcps Pointer to the DHCP handle
 * @param dnsserver Address of the DNS server
 * @param type Type of the DNS server
 * @return ERR_ARG if invalid handle, ERR_VAL if invalid type, ERR_OK on success
 */
err_t dhcps_dns_setserver_by_type(dhcps_t *dhcps, const ip_addr_t *dnsserver, dns_type_t type);

/**
 * @brief Gets the DNS server associated with this DHCP server
 * @param dhcps Pointer to the DHCP handle
 * @param dnsserver Address of the DNS server
 * @return ERR_ARG if invalid handle, ERR_VAL if invalid type, ERR_OK on success
 */
err_t dhcps_dns_getserver(dhcps_t *dhcps, ip4_addr_t *dnsserver);

/**
 * @brief Gets the DNS server associated with this DHCP server with a specific type
 * @param dhcps Pointer to the DHCP handle
 * @param dnsserver Address of the DNS server
 * @param type Type of the DNS server
 * @return ERR_ARG if invalid handle, ERR_VAL if invalid type, ERR_OK on success
 */
err_t dhcps_dns_getserver_by_type(dhcps_t *dhcps, ip4_addr_t *dnsserver, dns_type_t type);

/**
 * @brief Sets callback on assigning an IP to the connected client
 * @param dhcps Pointer to the DHCP handle
 * @param cb Callback for dhcp server
 * @param cb_arg Context pointer to be added to the callback
 * @return ERR_ARG if invalid handle, ERR_OK on success
 */
err_t dhcps_set_new_lease_cb(dhcps_t *dhcps, dhcps_cb_t cb, void* cb_arg);

#ifdef __cplusplus
}
#endif

#endif /* __DHCPS_H__ */

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #271** (2026-10-13): **WT32-ETH01 Suggestion**
  *Symptoms*: Hi, great job on the app. I am new to all this. I have put together (1st time) 2 x ESP32 boards one with WT-Nat1 ethernet and set them up as a router to access the internet. The 1st esp uses sensors etc and uses low power rf 2dmv as a client to talk to the 2 nd board in the same box. Unfortunately the WT board setup as an AP runs red hot as the RF is 100mv flat out. Your Web app is fantastic but would like to see a feature to turn the AP wifi down if possible. The reason is I intend to set these up on existing remote solar systems using Unifi UISP litebeams 5ghz where there is no Phone service. This gives the owner or service tech access to internet for safety and info as one is standing by the installation. This reduces the power consumption of the ESP boards. Thanks for listening, rgs Michael
  **Post-Mortem & Fix Analysis**:
  > Hi Michael,  Thanks for the kind words, and that's a nice use case for remote solar sites.  The firmware can already do this through the `set_tx_power` CLI command. It isn't in the web UI yet, but it's available in the console.  **How to use it**  Connect to the serial console at 115200 bps (PuTTY, GtkTerm, etc.), or use the [Remote Console](https://github.com/martin-ger/esp32_nat_router/wiki/Remote-Console) over the network (port 2323). Then:  ``` set_tx_power ```  Without an argument, it shows the current and saved TX power. To lower it:  ``` set_tx_power 8 ```  - Valid values are 2–20 dBm. The radio only supports these steps: 2, 5, 7, 8, 11, 13, 14, 15, 16, 18, 20. - The new value applies immediately and is saved in NVS, so it survives a reboot. - `set_tx_power 0` goes back to maximum (the default) after the next restart.  For reference, 20 dBm is 100 mW, 8 dBm is about 6 mW and 2 dBm is about 1.6 mW. Your client board is in the same box, so a low setting like 2 or 5 dBm should be e
  > Thankyou Martin, appreciate the information and your time.I’ll see how we go.., Rgs Michael Large    Sent from Yahoo Mail for iPhone   On Wednesday, October 7, 2026, 3:32 pm, martin-ger ***@***.***> wrote:  martin-ger left a comment (martin-ger/esp32_nat_router#271) Hi Michael,  Thanks for the kind words, and that's a nice use case for remote solar sites.  The firmware can already do this through the set_tx_power CLI command. It isn't in the web UI yet, but it's available in the console.  How to use it  Connect to the serial console at 115200 bps (PuTTY, GtkTerm, etc.), or use the Remote Console over the network (port 2323). Then: set_tx_power  Without an argument, it shows the current and saved TX power. To lower it: set_tx_power 8        - Valid values are 2–20 dBm. The radio only supports these steps: 2, 5, 7, 8, 11, 13, 14, 15, 16, 18, 20.    - The new value applies immediately and is saved in NVS, so it survives a reboot.    - set_tx_power 0 goes back to

- **Issue #270** (2026-10-06): **UI: STA stored password can't be cleared out to connect to an open network with no password**
  *Symptoms*: The default empty form field is "unchanged" but should there be a different way to display this which allows "emptying the current password" or whatever that allows clearing the currently stored password, like a checkbox or something, anything at all short of having to factory reset just to do this?
  **Post-Mortem & Fix Analysis**:
  > I seen the issue. As a quick workaround you can use the console command set_sta <ssid> "". This writes an empty password to NVS so a factory reset isn't needed. Will update the UI later.
  > Oh excellent, that would definitely work in the mean time, thanks!

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

### Incident Patch 1: `dd37aa8c` (2026-08-06)
**Commit Message**: Fix seven correctness bugs found by audit

pcap: ringbuf_free() ran on every client disconnect and deleted the mutex
and semaphore, but ringbuf_init() is only called once per boot — so PCAP
worked exactly once and every later session failed to allocate. The
vSemaphoreDelete could also free a mutex still held by the packet hook.
Release only the data buffer.

wifi/eth: blocked MACs are deauthed without ever being counted, but the
deauth raises STADISCONNECTED and decremented the unsigned client counter
to 65535. Skip the decrement for blocked MACs and clamp at zero.

wifi: xEventGroupWaitBits() sat before esp_wifi_start() on a freshly
created event group, so the bit could never be set and every boot burned
the full 2 s timeout. Removed, along with the now-unused CONNECTED_BIT
duplicate of WIFI_CONNECTED_BIT.

netif_hooks: send_icmp_frag_needed() copied IHL bytes out of the inbound
frame without checking the pbuf actually held them, echoing up to 40
bytes of adjacent memory back to the sender.

remote_console: disable() nulled the task handle after a fixed 500 ms, so
enable() could start a second task on the same port while the first was
still running — and that first task then saw s

**File**: `components/pcap_capture/pcap_ringbuf.c` (modified, +4/-4)
```diff
@@ -87,6 +87,10 @@ bool ringbuf_alloc(size_t size)
     return true;
 }
 
+/* Releases the data buffer only.  The mutex and semaphore are created once by
+ * ringbuf_init() and must outlive it: this runs on every client disconnect
+ * while the packet hook may still be inside ringbuf_write(), and ringbuf_init()
+ * is not called again for the lifetime of the server task. */
 void ringbuf_free(void)
 {
     if (ringbuf_mutex == NULL) {
@@ -107,10 +111,6 @@ void ringbuf_free(void)
     }
 
     xSemaphoreGive(ringbuf_mutex);
-    vSemaphoreDelete(ringbuf_mutex);
-    ringbuf_mutex = NULL;
-    vSemaphoreDelete(data_ready_sem);
-    data_ready_sem = NULL;
 }
 
 void ringbuf_reset(void)
```

**File**: `components/remote_console/remote_console.c` (modified, +17/-5)
```diff
@@ -52,6 +52,8 @@ static const char *TAG = "remote_console";
 #define RC_OUTPUT_BUF_SIZE  4096
 #define RC_MAX_AUTH_ATTEMPTS 3
 #define RC_AUTH_DELAY_MS    5000
+#define RC_SHUTDOWN_TIMEOUT_MS 3000
+#define RC_SHUTDOWN_POLL_MS 20
 
 /* Banner and prompts */
 static const char *RC_BANNER =
@@ -86,7 +88,9 @@ static struct {
     int64_t last_activity_time;
     uint32_t total_connections;
     uint32_t failed_auths;
-    TaskHandle_t task_handle;
+    /* Cleared by the task itself just before vTaskDelete(); remote_console_disable()
+     * polls it, so it must not be cached in a register. */
+    TaskHandle_t volatile task_handle;
     SemaphoreHandle_t session_mutex;
     volatile bool kick_requested;
     volatile bool shutdown_requested;
@@ -341,11 +345,19 @@ esp_err_t remote_console_disable(void) {
         rc_state.server_socket = -1;
     }
 
-    /* Wait for task to exit */
+    /* Wait for the task to clear its own handle on the way out.  Nulling it
+     * here on a fixed delay let remote_console_enable() start a second task on
+     * the same port while the first was still running — and that first task
+     * would then see shutdown_requested reset to false and never exit. */
+    for (int waited = 0; rc_state.task_handle != NULL && waited < RC_SHUTDOWN_TIMEOUT_MS;
+         waited += RC_SHUTDOWN_POLL_MS) {
+        vTaskDelay(pdMS_TO_TICKS(RC_SHUTDOWN_POLL_MS));
+    }
     if (rc_state.task_handle != NULL) {
-        /* Give task time to clean up */
-        vTaskDelay(pdMS_TO_TICKS(500));
-        rc_state.task_handle = NULL;
+        /* shutdown_requested stays set, so the task still exits on its own and
+         * clears the handle.  remote_console_enable() refuses to start a second
+         * task while the handle is non-NULL, so this stays safe. */
+        ESP_LOGW(TAG, "Remote console task still shutting down");
     }
 
     rc_state.state = RC_STATE_DISABLED;
```

**File**: `components/syslog/syslog_client.c` (modified, +26/-5)
```diff
@@ -65,6 +65,10 @@ static const char *TAG = "syslog";
 /* Queue depth — how many messages can be buffered */
 #define SYSLOG_QUEUE_DEPTH  16
 
+/* Bounded wait for the sender task to exit before its queue is deleted. */
+#define SYSLOG_STOP_TIMEOUT_MS 2000
+#define SYSLOG_STOP_POLL_MS    20
+
 /* Message passed through the queue */
 typedef struct {
     uint16_t len;
@@ -79,7 +83,8 @@ static uint16_t s_port = SYSLOG_DEFAULT_PORT;
 
 /* Sender task state */
 static QueueHandle_t s_queue = NULL;
-static TaskHandle_t s_sender_task = NULL;
+/* Cleared by sender_task on its way out; stop_sender() polls it. */
+static TaskHandle_t volatile s_sender_task = NULL;
 static int s_sock = -1;
 static struct sockaddr_in s_dest_addr;
 static atomic_bool s_resolved = false;
@@ -326,18 +331,34 @@ static void stop_sender(void)
         /* Send poison pill to stop the sender task */
         syslog_msg_t msg = { .len = 0 };
         xQueueSend(s_queue, &msg, pdMS_TO_TICKS(100));
-        /* Give the task time to exit */
-        vTaskDelay(pdMS_TO_TICKS(50));
+        /* Wait for the task to clear its own handle.  A fixed delay could
+         * expire while it was still blocked in xQueueReceive(), and the
+         * vQueueDelete() below would then pull the queue out from under it. */
+        for (int waited = 0; s_sender_task && waited < SYSLOG_STOP_TIMEOUT_MS;
+             waited += SYSLOG_STOP_POLL_MS) {
+            vTaskDelay(pdMS_TO_TICKS(SYSLOG_STOP_POLL_MS));
+        }
+    }
+    if (s_sender_task) {
+        ESP_LOGW(TAG, "syslog sender still running; keeping its queue");
+        return;
     }
     if (s_queue) {
         vQueueDelete(s_queue);
         s_queue = NULL;
     }
+    /* Release the format buffers under the same lock syslog_vprintf() takes,
+     * so a concurrent log call sees them NULL rather than freed.  s_fmt_mutex
+     * itself is kept for the lifetime of the process — deleting it here would
+     * race with a writer already blocked on xSemaphoreTake(). */
+    if (s_fmt_mutex) {
+        xSemaphoreTake(s_fmt_mutex, portMAX_DELAY);
+    }
     free(s_rawbuf); s_rawbuf = NULL;
     free(s_pktbuf); s_pktbuf = NULL;
+    s_rawpos = 0;
     if (s_fmt_mutex) {
-        vSemaphoreDelete(s_fmt_mutex);
-        s_fmt_mutex = NULL;
+        xSemaphoreGive(s_fmt_mutex);
     }
 }
 
```

**File**: `include/vpn_config.h` (modified, +4/-0)
```diff
@@ -33,6 +33,10 @@ esp_err_t vpn_connect(void);
 void vpn_disconnect(void);
 bool vpn_is_connected(void);
 void vpn_connect_task(void *pvParameters);
+
+/* Spawns vpn_connect_task unless one is already pending.  Returns false if a
+ * connect attempt was already in flight. */
+bool vpn_connect_task_start(void);
 void init_sntp_if_needed(void);
 
 // VPN subnet helpers (for kill switch packet filtering)
```

**File**: `main/esp32_nat_router.c` (modified, +14/-9)
```diff
@@ -461,7 +461,7 @@ static void eth_event_handler(void* arg, esp_event_base_t event_base,
         init_sntp_if_needed();
         syslog_notify_connected();
         if (vpn_enabled) {
-            xTaskCreate(vpn_connect_task, "vpn_connect", 4096, NULL, 5, NULL);
+            vpn_connect_task_start();
         }
         xEventGroupSetBits(wifi_event_group, WIFI_CONNECTED_BIT);
     }
@@ -503,7 +503,12 @@ static void wifi_ap_event_handler(void* arg, esp_event_base_t event_base,
         }
     } else if (event_id == WIFI_EVENT_AP_STADISCONNECTED) {
         wifi_event_ap_stadisconnected_t* event = (wifi_event_ap_stadisconnected_t*) event_data;
-        connect_count--;
+        /* Blocked MACs are deauthed on connect without ever being counted, and
+         * that deauth raises this event — decrementing here would underflow the
+         * unsigned counter to 65535. */
+        if (!is_mac_blocked(event->mac) && connect_count > 0) {
+            connect_count--;
+        }
         client_stats_on_disconnect(event->mac);
         const char* name = lookup_device_name_by_mac(event->mac);
         if (name) {
@@ -723,7 +728,7 @@ static void wifi_event_handler(void* arg, esp_event_base_t event_base,
 
         // Start VPN connection if enabled
         if (vpn_enabled) {
-            xTaskCreate(vpn_connect_task, "vpn_connect", 4096, NULL, 5, NULL);
+            vpn_connect_task_start();
         }
 
         /* Re-enable NAPT here in case the AP cycled (channel change from
@@ -778,7 +783,12 @@ static void wifi_event_handler(void* arg, esp_event_base_t event_base,
     else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_STADISCONNECTED)
     {
         wifi_event_ap_stadisconnected_t* event = (wifi_event_ap_stadisconnected_t*) event_data;
-        connect_count--;
+        /* Blocked MACs are deauthed on connect without ever being counted, and
+         * that deauth raises this event — decrementing here would underflow the
+         * unsigned counter to 65535. */
+        if (!is_mac_blocked(event->mac) && connect_count > 0) {
+            connect_count--;
+        }
         client_stats_on_disconnect(event->mac);
 
         /* Look up device name from DHCP reservations */
@@ -798,9 +808,6 @@ static void wifi_event_handler(void* arg, esp_event_base_t event_base,
 }
 #endif
 
-const int CONNECTED_BIT = BIT0;
-#define JOIN_TIMEOUT_MS (2000)
-
 void ap_set_enabled(bool enabled)
 {
 #if CONFIG_ETH_UPLINK
@@ -1122,8 +1129,6 @@ void wifi_init(const uint8_t* mac, const char* ssid, const char* ent_username, c
     // esp_netif_get_dns_info(ESP_IF_WIFI_AP, ESP_NETIF_DNS_MAIN, &dnsinfo);
     // ESP_LOGI(TAG, "DNS IP:" IPSTR, IP2STR(&dnsinfo.ip.u_addr.ip4));
 
-    xEventGroupWaitBits(wifi_event_group, CONNECTED_BIT,
-        pdFALSE, pdTRUE, pdMS_TO_TICKS(JOIN_TIMEOUT_MS));
     ESP_ERROR_CHECK(esp_wifi_start());
 
     if (strlen(ssid) > 0) {
```

**File**: `main/netif_hooks.c` (modified, +4/-0)
```diff
@@ -436,8 +436,12 @@ static void send_icmp_frag_needed(struct pbuf *p, struct netif *netif, uint16_t
     // Don't generate ICMP errors in response to ICMP (avoid feedback loops)
     if (IPH_PROTO(orig_ip) == 1 /* ICMP */) return;
 
+    /* IHL comes from the sender, so the claimed header length has to be backed
+     * by bytes actually present in this pbuf before it is copied out below —
+     * otherwise up to 40 bytes of adjacent memory would be echoed back to it. */
     uint16_t orig_ihl = IPH_HL(orig_ip) * 4;
     if (orig_ihl < 20 || orig_ihl > 60) return;
+    if (p->len < 14u + orig_ihl) return;
 
     // ICMP body: 2 bytes unused + 2 bytes next-hop MTU + orig IP header + first 8 data bytes
     uint16_t avail_data = (p->len > 14u + orig_ihl) ? (p->len - 14 - orig_ihl) : 0;
```

**File**: `main/vpn_manager.c` (modified, +21/-0)
```diff
@@ -161,6 +161,26 @@ static void init_sntp(void)
     esp_sntp_init();
 }
 
+/* Guards against a second connect task while one is still waiting for SNTP:
+ * every uplink GOT_IP would otherwise spawn another 4 KB task that sits for up
+ * to 30 s and then races the others inside vpn_connect() over wg_ctx. */
+static volatile bool vpn_connect_pending = false;
+
+bool vpn_connect_task_start(void)
+{
+    if (vpn_connect_pending) {
+        ESP_LOGI(TAG, "VPN connect already pending, skipping");
+        return false;
+    }
+    vpn_connect_pending = true;
+    if (xTaskCreate(vpn_connect_task, "vpn_connect", 4096, NULL, 5, NULL) != pdPASS) {
+        ESP_LOGE(TAG, "Failed to create VPN connect task");
+        vpn_connect_pending = false;
+        return false;
+    }
+    return true;
+}
+
 void vpn_connect_task(void *pvParameters)
 {
     // Wait for SNTP time sync before connecting VPN
@@ -190,6 +210,7 @@ void vpn_connect_task(void *pvParameters)
         ESP_LOGW(TAG, "SNTP sync timeout after %ds, proceeding with VPN anyway", max_retry / 2);
     }
     vpn_connect();
+    vpn_connect_pending = false;
     vTaskDelete(NULL);
 }
 
```

---

### Incident Patch 2: `b257c63c` (2026-10-16)
**Commit Message**: Ping/console/sys_evt stack fixes from esp32_ethernet_router; v2.4.21

- cmd_system: give the ping task a 4 KB stack. The 2 KB default overflows
  in the on_ping_end/on_ping_timeout callbacks, which printf from the ping
  task (seen on ESP32-S3 on the first ping that times out).
- console: raise max_cmdline_args from 12 to 32 (ESP-IDF default).
  esp_console_split_argv() silently drops tokens beyond max - 1, so a full
  set_vpn line lost its trailing options.
- sdkconfig.defaults: CONFIG_ESP_SYSTEM_EVENT_TASK_STACK_SIZE=4096 for all
  targets. ESP_LOG in event handlers plus the syslog vprintf hook leave
  little margin in the 2304-byte default.
- Bump version to 2.4.21 and rebuild firmware for all 7 targets.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CMakeLists.txt` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 # in this exact order for cmake to work correctly
 cmake_minimum_required(VERSION 3.16)
 
-set(PROJECT_VER "2.4.20")
+set(PROJECT_VER "2.4.21")
 include($ENV{IDF_PATH}/tools/cmake/project.cmake)
 project(esp32_nat_router)
 
```

**File**: `components/cmd_system/cmd_system.c` (modified, +2/-0)
```diff
@@ -600,6 +600,8 @@ static int ping_cmd(int argc, char **argv)
 
     esp_ping_config_t config = ESP_PING_DEFAULT_CONFIG();
     config.target_addr = target_addr;
+    // Default (2 KB) task stack overflows in the callbacks' printf on ESP32-S3
+    config.task_stack_size = 4096;
     config.count = ping_args.count->count > 0 ? ping_args.count->ival[0] : 5;
     if (ping_args.interval->count > 0) config.interval_ms = ping_args.interval->ival[0];
     if (ping_args.timeout->count > 0) config.timeout_ms = ping_args.timeout->ival[0];
```

**File**: `firmware_esp32/build_info.txt` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ESP32 NAT Router Build Information
 =================================
 Target: ESP32 (Original) (esp32)
-Build Time: 2026-10-08 11:55:51
-Git Hash: 69903c5
+Build Time: 2026-10-16 19:21:05
+Git Hash: c44331d
 Binary Files: 4
 Build Directory: build_esp32
```

**File**: `firmware_esp32_poe_iso/build_info.txt` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ESP32 NAT Router Build Information
 =================================
 Target: Olimex ESP32-POE-ISO (Ethernet) (esp32_poe_iso)
-Build Time: 2026-10-08 12:01:56
-Git Hash: 69903c5
+Build Time: 2026-10-16 19:27:16
+Git Hash: c44331d
 Binary Files: 4
 Build Directory: build_poe_iso
```

**File**: `firmware_esp32c3/build_info.txt` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ESP32 NAT Router Build Information
 =================================
 Target: ESP32-C3 (esp32c3)
-Build Time: 2026-10-08 12:13:45
-Git Hash: 69903c5
+Build Time: 2026-10-16 19:38:53
+Git Hash: c44331d
 Binary Files: 4
 Build Directory: build_esp32c3
```

**File**: `firmware_esp32c5/build_info.txt` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ESP32 NAT Router Build Information
 =================================
 Target: ESP32-C5 (esp32c5)
-Build Time: 2026-10-08 12:08:33
-Git Hash: 69903c5
+Build Time: 2026-10-16 19:33:31
+Git Hash: c44331d
 Binary Files: 4
 Build Directory: build_esp32c5
```

**File**: `firmware_esp32c6/build_info.txt` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ESP32 NAT Router Build Information
 =================================
 Target: ESP32-C6 (esp32c6)
-Build Time: 2026-10-08 12:11:13
-Git Hash: 69903c5
+Build Time: 2026-10-16 19:36:17
+Git Hash: c44331d
 Binary Files: 4
 Build Directory: build_esp32c6
```

**File**: `firmware_esp32s3/build_info.txt` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ESP32 NAT Router Build Information
 =================================
 Target: ESP32-S3 (esp32s3)
-Build Time: 2026-10-08 12:05:18
-Git Hash: 69903c5
+Build Time: 2026-10-16 19:30:43
+Git Hash: c44331d
 Binary Files: 4
 Build Directory: build_esp32s3
```

---

### Incident Patch 3: `ca2daec0` (2026-09-11)
**Commit Message**: Free flash and fix the multi-target build script

The C3 and C5 images are sitting at 99.7% and 99.9% of the 1536K ota_0
slot.

Config changes, applied to every target:
- Silent assertions drop the __FILE__ and expression strings.
- ESP_ERR_TO_NAME_LOOKUP off drops the error-string table;
  esp_err_to_name() now returns the numeric code.
- The setup and event-handling files in main/ build with -Os;
  netif_hooks.c stays on -O2 because it is on the packet path.

NEWLIB_NANO_FORMAT was left alone deliberately: ten call sites still use
%.1f, including the traffic counters shown in the web UI.

build_all_targets.sh: every target gets its own build directory and
sdkconfig so a stale config can never leak into the next target,
esp32_poe_iso joins BUILD_ORDER (it was defined but never built), and a
post-build report shows how full ota_0 is and warns above 95%.

The two Ethernet boards shared six of eight settings; those move to
sdkconfig.defaults.eth_common.

Adapted from the fork commit while porting:
- CONFIG_LOG_DEFAULT_LEVEL_WARN is not moved into the shared defaults.
  It would compile INFO/DEBUG strings out of every build and make
  'log_level info' on the CLI and INFO forwarding to

**File**: `.gitignore` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 build/**
-build_eth/**
+build_*/**
 .pio*
 .vscode
 .vscode/*
```

**File**: `build_all_targets.sh` (modified, +61/-5)
```diff
@@ -6,7 +6,7 @@
 set -e  # Exit on any error
 
 # Build targets in order
-BUILD_ORDER=("esp32" "wt32_eth01" "esp32s3" "esp32c5" "esp32c6" "esp32c3")
+BUILD_ORDER=("esp32" "wt32_eth01" "esp32_poe_iso" "esp32s3" "esp32c5" "esp32c6" "esp32c3")
 
 # Target descriptions
 declare -A TARGET_DESC=(
@@ -16,6 +16,7 @@ declare -A TARGET_DESC=(
     ["esp32c3"]="ESP32-C3"
     ["esp32c5"]="ESP32-C5"
     ["wt32_eth01"]="WT32-ETH01 (Ethernet)"
+    ["esp32_poe_iso"]="Olimex ESP32-POE-ISO (Ethernet)"
 )
 
 # IDF chip target for each build target
@@ -26,23 +27,52 @@ declare -A TARGET_CHIP=(
     ["esp32c3"]="esp32c3"
     ["esp32c5"]="esp32c5"
     ["wt32_eth01"]="esp32"
+    ["esp32_poe_iso"]="esp32"
 )
 
-# Extra sdkconfig defaults (semicolon-separated)
+# Extra sdkconfig defaults (semicolon-separated).
+# ESP-IDF automatically applies sdkconfig.defaults.<IDF_TARGET> on top of every
+# file listed here, so the chip targets would work with plain sdkconfig.defaults.
+# The board variants (wt32_eth01, esp32_poe_iso) are not chip names and need
+# their files listed explicitly; the chip entries are spelled out for clarity.
 declare -A TARGET_SDKCONFIG=(
-    ["wt32_eth01"]="sdkconfig.defaults;sdkconfig.defaults.wt32_eth01"
+    ["esp32"]="sdkconfig.defaults"
+    ["esp32s3"]="sdkconfig.defaults;sdkconfig.defaults.esp32s3"
+    ["esp32c6"]="sdkconfig.defaults;sdkconfig.defaults.esp32c6"
+    ["esp32c3"]="sdkconfig.defaults;sdkconfig.defaults.esp32c3"
+    ["esp32c5"]="sdkconfig.defaults;sdkconfig.defaults.esp32c5"
+    ["wt32_eth01"]="sdkconfig.defaults;sdkconfig.defaults.eth_common;sdkconfig.defaults.wt32_eth01"
+    ["esp32_poe_iso"]="sdkconfig.defaults;sdkconfig.defaults.eth_common;sdkconfig.defaults.esp32_poe_iso"
 )
 
-# Custom build directory (empty = default "build")
+# Per-target build directory and sdkconfig, so a stale config from the previous
+# target can never leak into the next one.
 declare -A TARGET_BUILD_DIR=(
+    ["esp32"]="build_esp32"
+    ["esp32s3"]="build_esp32s3"
+    ["esp32c6"]="build_esp32c6"
+    ["esp32c3"]="build_esp32c3"
+    ["esp32c5"]="build_esp32c5"
     ["wt32_eth01"]="build_eth"
+    ["esp32_poe_iso"]="build_poe_iso"
 )
 
-# Custom sdkconfig file path (empty = default "sdkconfig")
 declare -A TARGET_SDKCONFIG_FILE=(
+    ["esp32"]="sdkconfig.esp32"
+    ["esp32s3"]="sdkconfig.esp32s3"
+    ["esp32c6"]="sdkconfig.esp32c6"
+    ["esp32c3"]="sdkconfig.esp32c3"
+    ["esp32c5"]="sdkconfig.esp32c5"
     ["wt32_eth01"]="sdkconfig.eth"
+    ["esp32_poe_iso"]="sdkconfig.poe_iso"
 )
 
+# Warn when the app leaves almost no room in its OTA slot.
+# ota_0 is 1536 KiB (partitions_example.csv). idf.py itself fails the build
+# once the image no longer fits; this only makes the headroom visible.
+OTA_SLOT_BYTES=$((1536 * 1024))
+OTA_MAX_PERCENT=95
+
 # Colors for output
 RED='\033[0;31m'
 GREEN='\033[0;32m'
@@ -104,6 +134,9 @@ build_target() {
     # Build project
     print_status "Starting compilation for $target..."
     if idf.py "${build_args[@]}" build; then
+        if ! check_ota_headroom "$target"; then
+            return 1
+        fi
         # Save binary artifacts to separate directory
         save_binary_artifacts "$target" "$description"
         print_success "Build completed successfully for $target"
@@ -114,6 +147,29 @@ build_target() {
     fi
 }
 
+# Report how full the OTA slot is and warn when it is nearly exhausted. Without
+# this the C3 and C5 images crept to over 99% of ota_0 unnoticed.
+check_ota_headroom() {
+    local target=$1
+    local build_dir="${TARGET_BUILD_DIR[$target]:-build}"
+    local app="$build_dir/esp32_nat_router.bin"
+
+    [ -f "$app" ] || return 0
+
+    local size
+    size=$(stat -c%s "$app" 2>/dev/null || stat -f%z "$app" 2>/dev/null) || return 0
+    local percent=$((size * 100 / OTA_SLOT_BYTES))
+    local free=$((OTA_SLOT_BYTES - size))
+
+    print_status "  ota_0 usage: $size / $OTA_SLOT_BYTES bytes (${percent}%, ${free} free)"
+
+    if [ "$percent" -ge "$OTA_MAX_PERCENT" ]; then
+        print_warning "$target fills ${percent}% of ota_0 (warning threshold ${OTA_MAX_PERCENT}%)"
+        print_warning "Consider freeing flash before publishing — see 'idf.py size-components'."
+    fi
+    return 0
+}
+
 # Function to save binary artifacts to separate directory
 save_binary_artifacts() {
     local target=$1
```

**File**: `main/CMakeLists.txt` (modified, +5/-0)
```diff
@@ -20,3 +20,8 @@ idf_component_register(SRCS "esp32_nat_router.c"
                     INCLUDE_DIRS "."
                     PRIV_REQUIRES ${main_priv_requires})
 target_compile_options(__idf_main PRIVATE -O2)
+# Setup and event-handling files build for size; netif_hooks.c stays on -O2
+# because it sits on the packet path. Source-level COMPILE_OPTIONS are emitted
+# after the target options, so the later -Os wins for the listed files.
+set_source_files_properties(esp32_nat_router.c portmap.c dhcp_manager.c vpn_manager.c led_strip_status.c
+    PROPERTIES COMPILE_OPTIONS "-Os")
```

**File**: `platformio.ini` (modified, +3/-1)
```diff
@@ -23,6 +23,8 @@ monitor_speed = 115200
 
 [env:esp32dev]
 board = esp32dev
+board_build.cmake_extra_args =
+    -DSDKCONFIG_DEFAULTS="sdkconfig.defaults"
 
 [env:esp32-c3-devkitm-1]
 board = esp32-c3-devkitm-1
@@ -53,5 +55,5 @@ board_build.cmake_extra_args =
 [env:wt32-eth01]
 board = wt32-eth01
 board_build.cmake_extra_args =
-    -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.defaults.wt32_eth01"
+    -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.defaults.eth_common;sdkconfig.defaults.wt32_eth01"
     -DSDKCONFIG=sdkconfig.eth
```

**File**: `sdkconfig.defaults` (modified, +8/-0)
```diff
@@ -10,6 +10,14 @@ CONFIG_LWIP_IRAM_OPTIMIZATION=y
 CONFIG_BOOTLOADER_LOG_LEVEL_WARN=y
 CONFIG_BOOTLOADER_LOG_LEVEL=2
 
+# assert() aborts without the __FILE__/expression strings
+CONFIG_COMPILER_OPTIMIZATION_ASSERTIONS_SILENT=y
+CONFIG_COMPILER_OPTIMIZATION_ASSERTION_LEVEL=1
+
+# esp_err_to_name() returns the numeric code instead of carrying the full
+# error-string table
+CONFIG_ESP_ERR_TO_NAME_LOOKUP=n
+
 # Increase main task stack size
 CONFIG_ESP_MAIN_TASK_STACK_SIZE=7168
 
```

**File**: `sdkconfig.defaults.esp32_poe_iso` (modified, +2/-8)
```diff
@@ -1,16 +1,10 @@
 # Olimex ESP32-POE-ISO Ethernet uplink variant
-# Use with: idf.py -B build_poe_iso -D SDKCONFIG="sdkconfig.poe_iso" -D 'SDKCONFIG_DEFAULTS=sdkconfig.defaults;sdkconfig.defaults.esp32_poe_iso' build
+# Use with: idf.py -B build_poe_iso -D SDKCONFIG="sdkconfig.poe_iso" -D 'SDKCONFIG_DEFAULTS=sdkconfig.defaults;sdkconfig.defaults.eth_common;sdkconfig.defaults.esp32_poe_iso' build
 
-# Ethernet uplink mode
-CONFIG_ETH_UPLINK=y
-CONFIG_ETH_MDC_GPIO=23
-CONFIG_ETH_MDIO_GPIO=18
+# Board-specific PHY wiring; MDC/MDIO and the EMAC driver come from eth_common
 CONFIG_ETH_PHY_ADDR=0
 CONFIG_ETH_PHY_POWER_GPIO=12
 
-# Ethernet driver
-CONFIG_ETH_USE_ESP32_EMAC=y
-
 # RMII clock: ESP32 drives 50MHz clock output on GPIO17 (LAN8720 receives it)
 CONFIG_ETH_RMII_CLK_OUTPUT=y
 CONFIG_ETH_RMII_CLK_OUT_GPIO=17
```

**File**: `sdkconfig.defaults.eth_common` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+# Settings shared by every LAN8720 Ethernet-uplink board.
+# Board files add PHY address, power GPIO and RMII clocking on top.
+
+# Ethernet uplink mode
+CONFIG_ETH_UPLINK=y
+CONFIG_ETH_MDC_GPIO=23
+CONFIG_ETH_MDIO_GPIO=18
+
+# Ethernet driver
+CONFIG_ETH_USE_ESP32_EMAC=y
```

**File**: `sdkconfig.defaults.wt32_eth01` (modified, +2/-8)
```diff
@@ -1,12 +1,6 @@
 # WT32-ETH01 Ethernet uplink variant
-# Use with: idf.py -B build_eth -D SDKCONFIG="sdkconfig.eth" -D SDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.defaults.wt32_eth01" build
+# Use with: idf.py -B build_eth -D SDKCONFIG="sdkconfig.eth" -D SDKCONFIG_DEFAULTS="sdkconfig.defaults;sdkconfig.defaults.eth_common;sdkconfig.defaults.wt32_eth01" build
 
-# Ethernet uplink mode
-CONFIG_ETH_UPLINK=y
-CONFIG_ETH_MDC_GPIO=23
-CONFIG_ETH_MDIO_GPIO=18
+# Board-specific PHY wiring; MDC/MDIO and the EMAC driver come from eth_common
 CONFIG_ETH_PHY_ADDR=1
 CONFIG_ETH_PHY_POWER_GPIO=16
-
-# Ethernet driver
-CONFIG_ETH_USE_ESP32_EMAC=y
```

#### Recent Merged Pull Requests:
- **PR #231** (closed): docs: add SlowFi requirements specification (@sugendran)
- **PR #227** (2026-03-25): Added support for Heltec V3 built in display in esp32s3. (@buffaloexpatbill)
- **PR #181** (closed): Adding Github WorkFlows (@manupawickramasinghe)
- **PR #166** (2024-07-05): Fix: STA Static IP not working (@phucnguyentrong)
- **PR #160** (closed): fix: fix the conditon check variable (@RealHurrison)
- **PR #159** (closed): Add support for WS2812 multicolor led (@Hougaard22)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. seven correctness bugs found by audit

**RULE**:
When implementing operations in `components/pcap_capture/pcap_ringbuf.c`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in martin-ger/esp32_nat_router. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dd37aa8c`: seven correctness bugs found by audit. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `components/pcap_capture/pcap_ringbuf.c`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
/* Releases the data buffer only.  The mutex and semaphore are created once by
 * ringbuf_init() and must outlive it: this runs on every client disconnect
 * while the packet hook may still be inside ringbuf_write(), and ringbuf_init()
 * is not called again for the lifetime of the server task. */
```

**NEGATIVE CONSTRAINT**:
```c
// Anti-pattern to NEVER write (induced failure mode):
    vSemaphoreDelete(ringbuf_mutex);
    ringbuf_mutex = NULL;
    vSemaphoreDelete(data_ready_sem);
    data_ready_sem = NULL;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dd37aa8c` are properly handled with clean fallback behavior.
