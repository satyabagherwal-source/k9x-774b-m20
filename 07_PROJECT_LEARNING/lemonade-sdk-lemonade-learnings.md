# Forensic Learning Record (Deep Inspection): lemonade-sdk/lemonade

> **Canonical Artifact**: `07_PROJECT_LEARNING/lemonade-sdk-lemonade-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lemonade-sdk/lemonade](https://github.com/lemonade-sdk/lemonade))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:45:28.489Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lemonade-sdk/lemonade`
- **Description**: Lemonade helps users discover and run local AI apps by serving optimized LLMs right from their own GPUs and NPUs. Join our discord: https://discord.gg/5xXzkMu8Zk
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 5807 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `contrib/launchpad-downloads/ppa_stats.py`
```
#!/usr/bin/env python3
"""
Launchpad PPA Download Statistics Tool

This tool retrieves download statistics for packages in a Launchpad PPA.
"""

import os
import sys
import argparse
from launchpadlib.launchpad import Launchpad


def get_ppa_stats(username, ppa_name, package_name=None, show_all=False):
    """
    Get download statistics for a Launchpad PPA.

    Args:
        username: Launchpad username/team name
        ppa_name: Name of the PPA
        package_name: Optional specific package name to query
        show_all: Show all versions including those with 0 downloads

    Returns:
        Total downloads and list of package statistics
    """
    # Setup cache directory
    cachedir = os.path.expanduser("~/.launchpadlib/cache/")

    print(f"Connecting to Launchpad API...")
    launchpad = Launchpad.login_anonymously(
        "ppa-stats-tool", "production", cachedir, version="devel"
    )

    # Get the PPA
    try:
        print(f"Fetching PPA: {username}/{ppa_name}")
        ppa = launchpad.people[username].getPPAByName(name=ppa_name)
    except Exception as e:
        print(f"Error: Could not find PPA '{ppa_name}' for user '{username}'")
        print(f"Details: {e}")
        sys.exit(1)

    # Get published binaries
    if package_name:
        print(f"Fetching statistics for package: {package_name}")
        bins = ppa.getPublishedBinaries(binary_name=package_name)
    else:
        print(f"Fetching statistics for all packages...")
        bins = ppa.getPublishedBinaries()

    # Collect download counts
    builds = []
    total_downloads = 0

    for binary in bins:
        count = binary.getDownloadCount()
        total_downloads += count

        if count > 0 or show_all:
            builds.append(
                {
                    "count": count,
                    "name": binary.binary_package_name,
                    "version": binary.binary_package_version,
                    "arch": binary.distro_arch_series_link.split("/")[-1],
                }
            )

    # Sort by download count (descending)
    builds_sorted = sorted(builds, key=lambda x: x["count"], reverse=True)

    return total_downloads, builds_sorted


def print_stats(total_downloads, builds, show_details=True):
    """Print download statistics in a formatted way."""
    print("\n" + "=" * 70)
    print(f"TOTAL DOWNLOADS: {total_downloads:,}")
    print("=" * 70)

    if not builds:
        print("No packages found or no downloads recorded.")
        return

    if show_details:
        print(f"\n{'Downloads':<12} {'Package':<30} {'Version':<20} {'Arch':<10}")
        print("-" * 70)

        for build in builds:
            print(
                f"{build['count']:<12,} {build['name']:<30} {build['version']:<20} {build['arch']:<10}"
            )
    else:
        # Group by package name
        package_totals = {}
        for build in builds:
            name = build["name"]
            if name not in package_totals:
                package_totals[name] = 0
            package_totals[name] += build["count"]

        print(f"\n{'Downloads':<12} {'Package':<30}")
        print("-" * 42)

        for name, count in sorted(
            package_totals.items(), key=lambda x: x[1], reverse=True
        ):
            print(f"{count:<12,} {name:<30}")


def main():
    parser = argparse.ArgumentParser(
        description="Get download statistics for a Launchpad PPA",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s username/ppa-name
  %(prog)s developmentseed/mapbox -p tilemill
  %(prog)s myuser/myppa --all --summary
        """,
    )

    parser.add_argument("ppa", help="PPA in format: username/ppa-name")
    parser.add_argument(
        "-p", "--package", help="Specific package name to query (optional)"
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Show all versions including those with 0 downloads",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Show summary by package name instead of individual versions",
    )

    args = parser.parse_args()

    # Parse PPA format
    if "/" not in args.ppa:
        print("Error: PPA must be in format 'username/ppa-name'")
        sys.exit(1)

    username, ppa_name = args.ppa.split("/", 1)

    try:
        total, builds = get_ppa_stats(username, ppa_name, args.package, args.all)

        print_stats(total, builds, show_details=not args.summary)

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\nError: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/api_image_edits.py`
```
"""
This example demonstrates how to use the lemonade server API to edit
images using Stable Diffusion models via the OpenAI Python client.

Prerequisites:
1. Install the OpenAI client: pip install openai pillow
2. The lemonade server should be running (starts automatically after installation)
3. An image editing model will be auto-downloaded on first use
4. You need a source image to edit (example creates a simple one)

Usage:
    python api_image_edits.py
    python api_image_edits.py --backend rocm
    python api_image_edits.py --backend cpu
    python api_image_edits.py --image path/to/your/image.png
"""

import base64
import argparse
from pathlib import Path
from io import BytesIO


def create_sample_image():
    """Create a simple sample image for testing if none provided."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow not installed. Install with: pip install pillow")
        return None

    # Create a 512x512 white image with a simple shape
    img = Image.new("RGB", (512, 512), color="white")
    draw = ImageDraw.Draw(img)

    # Draw a simple landscape: green ground, blue sky, yellow sun
    draw.rectangle([(0, 256), (512, 512)], fill="green")  # Ground
    draw.rectangle([(0, 0), (512, 256)], fill="lightblue")  # Sky
    draw.ellipse([(400, 50), (480, 130)], fill="yellow")  # Sun

    output_path = Path("sample_image.png")
    img.save(output_path)
    print(f"Created sample image: {output_path.absolute()}")
    return output_path


def edit_image_with_openai_client(image_path, backend="cpu"):
    """Edit an image using the OpenAI Python client."""
    try:
        from openai import OpenAI
    except ImportError:
        print("OpenAI client not installed. Install with: pip install openai")
        return None

    # Point to local lemonade server
    client = OpenAI(
        base_url="http://localhost:13305/api/v1",
        api_key="not-needed",  # Lemonade doesn't require API key
    )

    print(f"Editing image with OpenAI client (backend: {backend})...")

    if backend == "cpu":
        print("(This may take several minutes with CPU backend)")

    # Read the image file
    with open(image_path, "rb") as image_file:
        response = client.images.edit(
            model="Flux-2-Klein-4B",  # or another editing model
            image=image_file,
            prompt="Add a red barn and mountains in the background, photorealistic",
            size="512x512",
            n=1,
        )

    # Save the edited image
    if response.data:
        image_data = base64.b64decode(response.data[0].b64_json)
        output_path = Path("edited_image_openai.png")
        output_path.write_bytes(image_data)
        print(f"Edited image saved to: {output_path.absolute()}")
        return output_path

    return None


def edit_image_with_requests(image_path, backend="cpu"):
    """Edit an image using the requests library with multipart form data."""
    try:
        import requests
    except ImportError:
        print("Requests not installed. Install with: pip install requests")
        return None

    print(f"Editing image with requests library (backend: {backend})...")

    if backend == "cpu":
        print("(This may take several minutes with CPU backend)")

    # Prepare the multipart form data
    with open(image_path, "rb") as image_file:
        files = {
            "image": ("image.png", image_file, "image/png"),
        }
        data = {
            "model": "SD-Turbo",
            "prompt": "Add a red barn and mountains in the background, photorealistic",
            "size": "512x512",
            "n": "1",
            "response_format": "b64_json",
        }

        response = requests.post(
            "http://localhost:13305/api/v1/images/edits",
            files=files,
            data=data,
            timeout=600,  # 10 minutes for image generation
        )

    if response.status_code == 200:
        result = response.json()
        if "data" in result and len(result["data"]) > 0:
            image_data = base64.b64decode(result["data"][0]["b64_json"])
            output_path = Path("edited_image_requests.png")
            output_path.write_bytes(image_data)
            print(f"Edited image saved to: {output_path.absolute()}")
            return output_path
        else:
            print(f"Unexpected response format: {result}")
    else:
        print(f"Error: {response.status_code}")
        print(response.text)

    return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Edit images using Lemonade server with Stable Diffusion"
    )
    parser.add_argument(
        "--backend",
        type=str,
        choices=["cpu", "rocm"],
        default="cpu",
        help="Backend to use for image editing (default: cpu). Use 'rocm' for AMD GPU acceleration.",
    )
    parser.add_argument(
        "--image",
        type=str,
        help="Path to the image to edit. If not provided, a sample image will be created.",
    )
    parser.add_argument(
        "--method",
        type=str,
        choices=["openai", "requests", "both"],
        default="both",
        help="Which method to use for API calls (default: both)",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Lemonade Image Editing Example")
    print("=" * 60)
    print()
    print("Make sure the lemonade server is running (lemonade status)")
    print()

    # Get or create an image
    if args.image:
        image_path = Path(args.image)
        if not image_path.exists():
            print(f"Error: Image file not found: {image_path}")
            exit(1)
    else:
        image_path = create_sample_image()
        if not image_path:
            exit(1)

    print()

    # Try editing with different methods
    results = []

    if args.method in ["openai", "both"]:
        print("--- Using OpenAI Client ---")
        result = edit_image_with_openai_client(image_path, args.backend)
        if result:
            results.append(result)
        print()

    if args.method in ["requests", "both"]:
        print("--- Using Requests Library ---")
        result = edit_image_with_requests(image_path, args.backend)
        if result:
            results.append(result)
        print()

    print("=" * 60)
    print("Done!")
    if results:
        print("Generated images:")
        for result in results:
            print(f"  - {result}")
    print()
    print("Note: The actual editing capabilities depend on the sd-cpp backend")
    print("and the loaded model. Some models may not support image editing yet.")

```

### Core Architecture Module: `examples/api_image_generation.py`
```
"""
This example demonstrates how to use the lemonade server API to generate
images using Stable Diffusion models via the OpenAI Python client.

Prerequisites:
1. Install the OpenAI client: pip install openai
2. The lemonade server should be running (starts automatically after installation)
3. The SD-Turbo model will be auto-downloaded on first use

Usage:
    python api_image_generation.py
    python api_image_generation.py --backend rocm
    python api_image_generation.py --backend cpu
"""

import base64
import argparse
from pathlib import Path


def generate_with_openai_client(backend="cpu"):
    """Generate image using the OpenAI Python client."""
    try:
        from openai import OpenAI
    except ImportError:
        print("OpenAI client not installed. Install with: pip install openai")
        return None

    # Point to local lemonade server
    client = OpenAI(
        base_url="http://localhost:13305/api/v1",
        api_key="not-needed",  # Lemonade doesn't require API key
    )

    print(f"Generating image with OpenAI client...{backend}")

    if backend == "cpu":
        print("(This may take several minutes with CPU backend)")

    response = client.images.generate(
        model="SD-Turbo",
        prompt="A serene mountain landscape at sunset, digital art",
        size="512x512",
        n=1,
        response_format="b64_json",
        # SD-specific parameters (passed through)
        extra_body={
            "steps": 4,  # SD-Turbo works well with 4 steps
            "cfg_scale": 1.0,  # SD-Turbo uses low CFG
        },
    )

    # Save the image
    if response.data:
        image_data = base64.b64decode(response.data[0].b64_json)
        output_path = Path("generated_image_openai.png")
        output_path.write_bytes(image_data)
        print(f"Image saved to: {output_path.absolute()}")
        return output_path

    return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate images using Lemonade server with Stable Diffusion"
    )
    parser.add_argument(
        "--backend",
        type=str,
        choices=["cpu", "rocm"],
        default="cpu",
        help="Backend to use for image generation (default: cpu). Use 'rocm' for AMD GPU acceleration.",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Lemonade Image Generation Example")
    print("=" * 60)
    print()
    print("Make sure the lemonade server is running (lemonade status)")
    print()

    # Generate using OpenAI client
    result = generate_with_openai_client(args.backend)

    print()
    print("=" * 60)
    print("Done!")
    if result:
        print(f"Generated image saved to: {result}")

```

### Core Architecture Module: `examples/api_image_variations.py`
```
"""
This example demonstrates how to use the lemonade server API to create
variations of images using Stable Diffusion models via the OpenAI Python client.

Prerequisites:
1. Install the OpenAI client: pip install openai pillow
2. The lemonade server should be running (starts automatically after installation)
3. An image model will be auto-downloaded on first use
4. You need a source image (example creates a simple one)

Usage:
    python api_image_variations.py
    python api_image_variations.py --backend rocm
    python api_image_variations.py --backend cpu
    python api_image_variations.py --image path/to/your/image.png
    python api_image_variations.py --num-variations 3
"""

import base64
import argparse
from pathlib import Path
from io import BytesIO


def create_sample_image():
    """Create a simple sample image for testing if none provided."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow not installed. Install with: pip install pillow")
        return None

    # Create a 512x512 image with a simple pattern
    img = Image.new("RGB", (512, 512), color="white")
    draw = ImageDraw.Draw(img)

    # Draw a simple scene
    draw.rectangle([(0, 256), (512, 512)], fill="lightgreen")  # Ground
    draw.rectangle([(0, 0), (512, 256)], fill="skyblue")  # Sky
    draw.ellipse([(350, 50), (450, 150)], fill="gold")  # Sun
    draw.rectangle([(200, 180), (300, 300)], fill="brown")  # Tree trunk
    draw.ellipse([(150, 80), (350, 220)], fill="darkgreen")  # Tree foliage

    output_path = Path("sample_image_variations.png")
    img.save(output_path)
    print(f"Created sample image: {output_path.absolute()}")
    return output_path


def create_variations_with_openai_client(image_path, num_variations=1, backend="cpu"):
    """Create image variations using the OpenAI Python client."""
    try:
        from openai import OpenAI
    except ImportError:
        print("OpenAI client not installed. Install with: pip install openai")
        return []

    # Point to local lemonade server
    client = OpenAI(
        base_url="http://localhost:13305/api/v1",
        api_key="not-needed",  # Lemonade doesn't require API key
    )

    print(
        f"Creating {num_variations} variation(s) with OpenAI client (backend: {backend})..."
    )

    if backend == "cpu":
        print("(This may take several minutes with CPU backend)")

    results = []

    # Read the image file
    with open(image_path, "rb") as image_file:
        try:
            response = client.images.create_variation(
                model="SD-Turbo",
                image=image_file,
                size="512x512",
                n=num_variations,
                response_format="b64_json",
            )
        except Exception as e:
            print(f"Error: {e}")
            return results

    # Save the variations
    if response.data:
        for i, image_obj in enumerate(response.data):
            image_data = base64.b64decode(image_obj.b64_json)
            output_path = Path(f"variation_openai_{i+1}.png")
            output_path.write_bytes(image_data)
            print(f"Variation {i+1} saved to: {output_path.absolute()}")
            results.append(output_path)

    return results


def create_variations_with_requests(image_path, num_variations=1, backend="cpu"):
    """Create image variations using the requests library with multipart form data."""
    try:
        import requests
    except ImportError:
        print("Requests not installed. Install with: pip install requests")
        return []

    print(
        f"Creating {num_variations} variation(s) with requests library (backend: {backend})..."
    )

    if backend == "cpu":
        print("(This may take several minutes with CPU backend)")

    results = []

    # Prepare the multipart form data
    with open(image_path, "rb") as image_file:
        files = {
            "image": ("image.png", image_file, "image/png"),
        }
        data = {
            "model": "SD-Turbo",
            "size": "512x512",
            "n": str(num_variations),
            "response_format": "b64_json",
        }

        response = requests.post(
            "http://localhost:13305/api/v1/images/variations",
            files=files,
            data=data,
            timeout=600,  # 10 minutes for image generation
        )

    if response.status_code == 200:
        result = response.json()
        if "data" in result and len(result["data"]) > 0:
            for i, image_obj in enumerate(result["data"]):
                image_data = base64.b64decode(image_obj["b64_json"])
                output_path = Path(f"variation_requests_{i+1}.png")
                output_path.write_bytes(image_data)
                print(f"Variation {i+1} saved to: {output_path.absolute()}")
                results.append(output_path)
        else:
            print(f"Unexpected response format: {result}")
    else:
        print(f"Error: {response.status_code}")
        print(response.text)

    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Create image variations using Lemonade server with Stable Diffusion"
    )
    parser.add_argument(
        "--backend",
        type=str,
        choices=["cpu", "rocm"],
        default="cpu",
        help="Backend to use for image variations (default: cpu). Use 'rocm' for AMD GPU acceleration.",
    )
    parser.add_argument(
        "--image",
        type=str,
        help="Path to the source image. If not provided, a sample image will be created.",
    )
    parser.add_argument(
        "--num-variations",
        type=int,
        default=1,
        help="Number of variations to generate (default: 1)",
    )
    parser.add_argument(
        "--method",
        type=str,
        choices=["openai", "requests", "both"],
        default="both",
        help="Which method to use for API calls (default: both)",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Lemonade Image Variations Example")
    print("=" * 60)
    print()
    print("Make sure the lemonade server is running (lemonade status)")
    print()

    # Get or create an image
    if args.image:
        image_path = Path(args.image)
        if not image_path.exists():
            print(f"Error: Image file not found: {image_path}")
            exit(1)
    else:
        image_path = create_sample_image()
        if not image_path:
            exit(1)

    print()

    # Try creating variations with different methods
    all_results = []

    if args.method in ["openai", "both"]:
        print("--- Using OpenAI Client ---")
        results = create_variations_with_openai_client(
            image_path, args.num_variations, args.backend
        )
        all_results.extend(results)
        print()

    if args.method in ["requests", "both"]:
        print("--- Using Requests Library ---")
        results = create_variations_with_requests(
            image_path, args.num_variations, args.backend
        )
        all_results.extend(results)
        print()

    print("=" * 60)
    print("Done!")
    if all_results:
        print(f"Generated {len(all_results)} variation(s):")
        for result in all_results:
            print(f"  - {result}")
    print()
    print("Note: The actual variation capabilities depend on the sd-cpp backend")
    print("and the loaded model. Some models may not support image variations yet.")

```

### Core Architecture Module: `examples/api_text_to_speech.py`
```
"""
This example demonstrates how to use the lemonade server API to generate
speech using Kokoro via the OpenAI Python client.

Prerequisites:
1. Install the OpenAI client: pip install openai openai[voice_helpers]
2. The lemonade server should be running (starts automatically after installation)
3. The kokoro-v1 model will be auto-downloaded on first use

Usage:
    python api_text_to_speech.py
"""

import base64
import asyncio
from pathlib import Path


async def generate_with_openai_client():
    """Generate image using the OpenAI Python client."""
    try:
        from openai import AsyncOpenAI
        from openai.helpers import LocalAudioPlayer
    except ImportError:
        print("OpenAI client not installed. Install with: pip install openai")
        return None

    # Point to local lemonade server
    client = AsyncOpenAI(
        base_url="http://localhost:13305/api/v1",
        api_key="not-needed",  # Lemonade doesn't require API key by default
    )

    print("Generating speech with OpenAI client...")
    print("(This may take several seconds)")

    async with client.audio.speech.with_streaming_response.create(
        model="kokoro-v1",
        voice="coral",
        input="Today is a wonderful day to build something people love!",
        stream_format="audio",
    ) as response:
        await LocalAudioPlayer().play(response)


if __name__ == "__main__":
    print("=" * 60)
    print("Lemonade Text to Speech Example")
    print("=" * 60)
    print()
    print("Make sure the lemonade server is running (lemonade status)")
    print()

    # Generate using OpenAI client
    asyncio.run(generate_with_openai_client())

    print()
    print("=" * 60)
    print("Done!")

```

### Core Architecture Module: `examples/lemonade_tools.py`
```
"""
Lemonade Omni Models: tool calling agentic loop example.

Demonstrates how to use Lemonade's multimodal endpoints as tools in an
LLM agentic loop (the OmniRouter pattern — each modality exposed as an
OpenAI-compatible tool). The LLM decides which tool to call; this
script executes the tool against Lemonade's API and feeds the result
back.

Prerequisites:
    pip install openai

Running the Lemonade server with the models referenced below already
downloaded is easiest — install LMX-Omni-5.5B-Lite from the desktop app
(Model Manager > Lemonade > LMX-Omni-5.5B-Lite > Download) and
you'll have everything in one click. Otherwise, pull the models below
individually via `lemonade pull <name>`.

Usage:
    python examples/lemonade_tools.py "Generate an image of a sunset"
    python examples/lemonade_tools.py "Say hello world out loud"
"""

import json
import base64
import sys
import urllib.request
from openai import OpenAI

# Print non-ASCII characters (emoji) without choking on Windows cp1252
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

LEMONADE_URL = "http://localhost:13305/v1"

# Edit these to match models you have installed. Defaults are small so
# they fit on most hardware (and match LMX-Omni-5.5B-Lite).
LLM_MODEL = "Qwen3.5-4B-MTP-GGUF"  # any model with the "tool-calling" label
IMAGE_MODEL = "SD-Turbo"  # any model with the "image" label
TTS_MODEL = "kokoro-v1"  # any model with the "tts" label

# Tool definitions — same format src/app/src/renderer/utils/toolDefinitions.json uses
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_image",
            "description": "Generate an image from a text description.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "A detailed description of the image to generate",
                    },
                },
                "required": ["prompt"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "text_to_speech",
            "description": "Convert text to spoken audio.",
            "parameters": {
                "type": "object",
                "properties": {
                    "input": {
                        "type": "string",
                        "description": "The text to convert to speech",
                    },
                },
                "required": ["input"],
            },
        },
    },
]

SYSTEM_PROMPT = (
    "You are a helpful assistant with access to tools for generating images "
    "and converting text to speech. Use the appropriate tool when the user "
    "asks for an image or audio. After using a tool, briefly describe what "
    "you did."
)


def execute_tool(client, tool_call):
    name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    if name == "generate_image":
        result = client.images.generate(
            model=IMAGE_MODEL,
            prompt=args["prompt"],
            response_format="b64_json",
            n=1,
        )
        image_b64 = result.data[0].b64_json
        with open("output.png", "wb") as f:
            f.write(base64.b64decode(image_b64))
        print(f"  -> Image saved to output.png ({len(image_b64)} base64 chars)")
        return "Image generated and saved to output.png."

    if name == "text_to_speech":
        audio = client.audio.speech.create(
            model=TTS_MODEL,
            input=args["input"],
            voice="af_heart",
        )
        audio.write_to_file("output.wav")
        print("  -> Audio saved to output.wav")
        return "Audio generated and saved to output.wav."

    return f"Unknown tool: {name}"


def preflight_models():
    """Hit /v1/models?show_all=true and fail loudly if any hardcoded
    model name isn't present. Without this, the first tool call just
    returns a 404 and it's not obvious what went wrong."""
    try:
        with urllib.request.urlopen(
            f"{LEMONADE_URL}/models?show_all=true", timeout=5
        ) as r:
            models = {m["id"]: m for m in json.load(r).get("data", [])}
    except Exception as e:
        print(f"Can't reach Lemonade at {LEMONADE_URL}: {e}", file=sys.stderr)
        print("Is the server running? (desktop app, or `lemond`)", file=sys.stderr)
        sys.exit(1)

    missing = [
        name for name in (LLM_MODEL, IMAGE_MODEL, TTS_MODEL) if name not in models
    ]
    if missing:
        print(f"Required models not installed: {', '.join(missing)}", file=sys.stderr)
        print(
            "Fix: open the desktop app and download LMX-Omni-5.5B-Lite,",
            file=sys.stderr,
        )
        print(
            "or edit LLM_MODEL / IMAGE_MODEL / TTS_MODEL at the top of", file=sys.stderr
        )
        print("this script to match models you already have.", file=sys.stderr)
        sys.exit(1)


def main():
    prompt = (
        " ".join(sys.argv[1:])
        if len(sys.argv) > 1
        else "Generate an image of a cat in space"
    )
    print(f"User: {prompt}\n")

    preflight_models()

    client = OpenAI(base_url=LEMONADE_URL, api_key="not-needed")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    # Agentic loop (max 3 iterations)
    for i in range(3):
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            tools=TOOLS,
        )

        message = response.choices[0].message

        if not message.tool_calls:
            print(f"Assistant: {message.content}")
            break

        messages.append(message)

        for tool_call in message.tool_calls:
            print(f"  [Tool] {tool_call.function.name}({tool_call.function.arguments})")
            result = execute_tool(client, tool_call)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                }
            )
    else:
        print("(max iterations reached)")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/realtime_transcription.py`
```
"""
Realtime Audio Transcription with OpenAI SDK

Uses the official OpenAI SDK to connect to Lemonade Server's
OpenAI-compatible realtime transcription endpoint.

Requirements:
    pip install openai pyaudio websockets

Usage:
    python realtime_transcription.py
    python realtime_transcription.py --model Whisper-Small
"""

import argparse
import asyncio
import base64
import struct
import sys
import os

# Enable ANSI escape codes on Windows
if os.name == "nt":
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32
        # Enable ENABLE_VIRTUAL_TERMINAL_PROCESSING
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except:
        pass

# Check dependencies
try:
    from openai import AsyncOpenAI
except ImportError:
    print("Error: openai library not found.")
    print("Install it with: pip install openai")
    sys.exit(1)

try:
    import pyaudio
except ImportError:
    print("Error: pyaudio library not found.")
    print("Install it with: pip install pyaudio")
    sys.exit(1)

try:
    import websockets  # noqa: F401 — required by openai SDK for realtime
except ImportError:
    print("Error: websockets library not found.")
    print("Install it with: pip install websockets")
    sys.exit(1)

TARGET_RATE = 16000  # Whisper expects 16kHz mono PCM16
CHUNK_SIZE = 4096  # Samples per read at native rate (~85ms at 48kHz)


def downsample_to_16k(pcm16_bytes, native_rate):
    """Downsample PCM16 audio from native_rate to 16kHz using linear interpolation.

    Matches the resampling approach used in the Electron app's useAudioCapture hook.
    """
    if native_rate == TARGET_RATE:
        return pcm16_bytes

    n_samples = len(pcm16_bytes) // 2
    samples = struct.unpack(f"<{n_samples}h", pcm16_bytes)

    ratio = native_rate / TARGET_RATE
    output_length = int(n_samples / ratio)
    output = bytearray(output_length * 2)

    for i in range(output_length):
        src_idx = i * ratio
        idx_floor = int(src_idx)
        idx_ceil = min(idx_floor + 1, n_samples - 1)
        frac = src_idx - idx_floor
        sample = samples[idx_floor] * (1 - frac) + samples[idx_ceil] * frac
        clamped = max(-32768, min(32767, int(sample)))
        struct.pack_into("<h", output, i * 2, clamped)

    return bytes(output)


def transcribe_microphone(model: str, server_url: str):
    """Stream microphone audio using OpenAI SDK's realtime API."""
    import urllib.request
    import json

    # Load model via REST API first
    print(f"Loading model: {model}...")
    try:
        req = urllib.request.Request(
            f"{server_url}/load",
            data=json.dumps({"model_name": model}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            print(f"Model loaded: {model}")
    except Exception as e:
        print(f"Error loading model: {e}")
        print("Make sure Lemonade Server is running: lemonade status")
        return

    # Get WebSocket port from /health endpoint
    try:
        health_url = server_url + "/health"
        with urllib.request.urlopen(health_url, timeout=10) as resp:
            health = json.loads(resp.read().decode())
            ws_port = health.get("websocket_port")
            if not ws_port:
                print(
                    "Error: Server did not provide websocket_port in /health response"
                )
                return
            print(f"WebSocket port: {ws_port}")
    except Exception as e:
        print(f"Error fetching WebSocket port: {e}")
        return

    # Create OpenAI client pointing at local server
    client = AsyncOpenAI(
        api_key="unused",
        base_url=server_url,
        websocket_base_url=f"ws://localhost:{ws_port}",
    )

    async def run():
        print("Connecting to realtime endpoint...")

        async with client.beta.realtime.connect(model=model) as conn:
            # Wait for session.created
            event = await asyncio.wait_for(conn.recv(), timeout=10)
            print(f"Session: {event.session.id}")

            # Initialize microphone at its native sample rate
            pa = pyaudio.PyAudio()
            device_info = pa.get_default_input_device_info()
            native_rate = int(device_info["defaultSampleRate"])
            print(f"Microphone native sample rate: {native_rate} Hz")

            stream = pa.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=native_rate,
                input=True,
                frames_per_buffer=CHUNK_SIZE,
            )

            print("Recording... Press Ctrl+C to stop")
            print("-" * 40)

            transcripts = []

            async def send_audio():
                try:
                    while True:
                        data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                        # Downsample from native rate to 16kHz (matching Electron app)
                        data = downsample_to_16k(data, native_rate)
                        await conn.input_audio_buffer.append(
                            audio=base64.b64encode(data).decode()
                        )
                        await asyncio.sleep(0.01)
                except asyncio.CancelledError:
                    pass

            async def receive_messages():
                nonlocal transcripts
                # Get terminal width to avoid line-wrapping issues with \r
                try:
                    term_width = os.get_terminal_size().columns
                except OSError:
                    term_width = 80
                try:
                    async for event in conn:
                        if (
                            event.type
                            == "conversation.item.input_audio_transcription.delta"
                        ):
                            delta_text = (
                                getattr(event, "delta", "").replace("\n", " ").strip()
                            )
                            if delta_text:
                                # Truncate to one terminal line so \r can fully overwrite
                                if len(delta_text) > term_width - 4:
                                    delta_text = "..." + delta_text[-(term_width - 4) :]
                                print(f"\r\033[2K{delta_text}", end="", flush=True)
                        elif (
                            event.type
                            == "conversation.item.input_audio_transcription.completed"
                        ):
                            transcript = (
                                getattr(event, "transcript", "")
                                .replace("\n", " ")
                                .strip()
                            )
                            if transcript:
                                transcripts.append(transcript)
                                # Clear interim line, print final on its own line
                                print(f"\r\033[2K{transcript}")
                        elif event.type == "error":
                            error = getattr(event, "error", None)
                            msg = (
                                getattr(error, "message", "Unknown")
                                if error
                                else "Unknown"
                            )
                            print(f"\nError: {msg}")
                except asyncio.CancelledError:
                    pass

            send_task = asyncio.create_task(send_audio())
            recv_task = asyncio.create_task(receive_messages())

            try:
                await asyncio.gather(send_task, recv_task)
            except KeyboardInterrupt:
                print("\n\nStopping...")
                send_task.cancel()
                recv_task.cancel()

                # Commit remaining audio
                await conn.input_audio_buffer.commit()


```

### Core Architecture Module: `examples/router/demo.py`
```
"""Lemonade Router demo — one policy, four prompts, watch where each is routed.

Drives a `collection.router` collection with a vanilla OpenAI client. The server
picks a candidate per the policy's first-matching rule (fail-open to
`default_model`) and reports its decision two ways:

  * response header `x-lemonade-route`  -> the matched rule id (or "default")
  * response body `x_lemonade_route`    -> { route_to, matched_rule, default_used,
                                             outputs, trace[] }  (with route_trace=true)

`route_to` is the candidate that actually answered.

Usage:
    python examples/router/demo.py --model user.Demo-Router-Local
    python examples/router/demo.py --model user.Demo-Router-Cloud --base-url http://localhost:13305/api/v1
"""

import argparse

from openai import OpenAI

LONG_PROMPT = "Summarize the following log. " + (
    "error timeout retry " * 260
)  # > 4000 chars

CASES = [
    {
        "name": "casual",
        "prompt": "Give me a fun fact about otters.",
        "metadata": None,
        "expect_route_to": "small/default",
    },
    {
        "name": "coding",
        "prompt": "Write a Python function to reverse a singly linked list.",
        "metadata": None,
        "expect_route_to": "capable (keyword 'function'/'def ')",
    },
    {
        "name": "long-context",
        "prompt": LONG_PROMPT,
        "metadata": None,
        "expect_route_to": "capable (min_chars >= 4000)",
    },
    {
        "name": "coding-but-consent-denied",
        "prompt": "Write a Python function to reverse a singly linked list.",
        "metadata": {"consent": "denied"},
        "expect_route_to": "small/default (privacy rule wins first-match)",
    },
]


def run_case(client, model, case):
    extra_body = {"route_trace": True}
    if case["metadata"] is not None:
        extra_body["metadata"] = case["metadata"]

    raw = client.chat.completions.with_raw_response.create(
        model=model,
        messages=[{"role": "user", "content": case["prompt"]}],
        max_tokens=64,
        temperature=0.0,
        extra_body=extra_body,
    )
    header_route = raw.headers.get("x-lemonade-route", "<missing>")
    body = raw.http_response.json()
    decision = body.get("x_lemonade_route", {})
    answered_by = body.get("model", "<unknown>")

    print(f"\n=== case: {case['name']} ===")
    print(f"  chars in prompt        : {len(case['prompt'])}")
    if case["metadata"]:
        print(f"  metadata               : {case['metadata']}")
    print(f"  expected               : {case['expect_route_to']}")
    print(f"  x-lemonade-route (hdr) : {header_route}")
    print(f"  route_to (body)        : {decision.get('route_to', '<missing>')}")
    print(f"  matched_rule           : {decision.get('matched_rule', '<missing>')}")
    print(f"  default_used           : {decision.get('default_used', '<missing>')}")
    print(f"  outputs                : {decision.get('outputs', {})}")
    print(f"  response 'model' field : {answered_by}")
    trace = decision.get("trace", [])
    if trace:
        print("  trace:")
        for t in trace:
            score = f" score={t['score']:.3f}" if "score" in t else ""
            print(f"    - {t['condition']}: {t['result']}{score}")
    return decision


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="collection.router model name")
    ap.add_argument("--base-url", default="http://localhost:13305/api/v1")
    ap.add_argument("--api-key", default="lemonade")
    args = ap.parse_args()

    client = OpenAI(base_url=args.base_url, api_key=args.api_key)
    print(f"Router demo -> model={args.model!r}  base_url={args.base_url}")
    for case in CASES:
        run_case(client, args.model, case)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3686** (2026-09-30): **`lemonade bench` "no suitable backends" error**
  *Symptoms*: `lemonade bench` currently only works with backends that are already installed, and displays a non-actionable error message if no backends are installed.  Reproduction: 1. Download and untar a fresh copy of embeddable lemonade 2. `./lemond ./ ./` start lemond with no backends preinstalled 3. `lemonade bench --backend rocm --scenarios chat Qwen3.5-4B-GGUF` 4. `Error: No suitable backends found for model 'Qwen3.5-4B-GGUF'.`  The workaround is to `./lemonade backends install llamacpp:rocm` between steps 2 and 3 above.  There are two ways to make this actionable for users: 1. Change the error message to suggest a specific backend install command that would get the user unblocked. 2. Install the backend on behalf of the user.  @bitgamma would you kindly implement one or the other? Appreciate it!
  **Post-Mortem & Fix Analysis**:
  > I think I'll do both:  1. if --backend is passed explicitly => try to install automatically 2. if not, and no backend is found => suggest to manually install a backend using the appropriate command.  @jeremyfowers do you agree with this plan?

- **Issue #3684** (2026-09-29): **fix(config): reject invalid backend-specific keys**
  *Symptoms*: ## Spec Driven Development  This PR: - [x] fixes something (closes #3678) and does not need a WG/RFC. - [ ] is within the scope of WG: - [ ] has approved RFC #  ## Summary  Closes #3678  | | before | after | |---|---|---| | `validate_backend` `_bin` / `_args` check | `key.find("_bin")` / `key.find("_args")` substring match | `<variant>_bin` / `<variant>_args` where `<variant>` is in the section descriptor's `bin_variants` / `arg_variants` or `support` backends | | `flm.flm_bin`, `flm.random_bin`, `flm.foo_args` | accepted, never read | `Unknown key: 'flm.<key>'` | | `flm.npu_bin`, `llamacpp.metal_bin`, `llamacpp.cuda_args`, `llamacpp.args` | accepted | accepted |  ## Scope  - [x] This PR addresses one clear issue or change. - [x] I reviewed the full diff myself before submitting. - [x] I removed unrelated local changes. - [x] I kept refactoring separate unless it is required for this change.  ## Testing  - [x] The code change has been locally tested.  _Testing details:_  | command | result | |---|---| | `test/cpp/test_runtime_config_backend_validation.cpp` (20 cases via `RuntimeConfig::set()`) | pass | | `ctest --test-dir build -L "^cpp-ci$"` | 72/72 pass | | `test/server_endpoints.py` `test_066_backend_bin_and_args_keys_must_name_a_real_variant` vs live `lemond` | pass | | `lemonade config set flm.flm_bin=builtin` / `flm.npu_bin=builtin` | rejected / accepted | | `pre-commit`, `gen_backend_boilerplate.py --check` | pass |  ## Documentati

- **Issue #3682** (2026-09-29): **Kokoro: British and French voices return ~0.3s of audio regardless of input**
  *Symptoms*: Five Kokoro voices return a fixed ~0.3s of audio no matter what text you send. All the others work.  ``` curl -s localhost:8000/api/v1/audio/speech -H 'Content-Type: application/json' \   -d '{"model":"kokoro-v1","voice":"bm_george","input":"The quick brown fox jumps over the lazy dog today.","response_format":"wav"}' -o out.wav ffprobe -v error -show_entries format=duration -of csv=p=0 out.wav ```  Duration for the same sentence, one voice per row:  ``` af_heart     3.75    bf_emma       0.33 af_bella     4.13    bf_isabella   0.30 af_nicole    5.30    bm_george     0.33 af_sarah     4.23    bm_lewis      0.45 am_michael   4.28    ff_siwis      0.50 am_adam      3.85 am_onyx      4.20 ef_dora      3.15 em_alex      3.25 if_sara      3.40 im_nicola    3.78 pf_dora      3.33 pm_alex      3.35 jf_alpha    11.97 zf_xiaobei   4.70 hf_alpha     4.23 ```  So it's the four British English voices plus the French one. Spanish, Italian, Portuguese, Japanese, Mandarin and Hindi are all fine.  It's not text-dependent — `bm_george` gives 0.325s for a 10-word sentence and 0.325s for a 35-word one, while `am_michael` goes 4.28s -> 14.10s on the same pair. Looks like a fixed stub rather than truncated synthesis.  Returns HTTP 200 with a valid WAV, so nothing signals a failure. Anything scripted against it just gets silence.  Guessing the voice embeddings are missing from the bundled `voices-v1.0.bin`, but I can't check — the file isn't readable under `/var/cache/lemonade`.  Related but not t
  **Post-Mortem & Fix Analysis**:
  > This is the leftover half of #1925. The `ESPEAK_DATA_PATH` fix landed, but the `espeak-ng-data` we bundle with koko b17 has no `en-gb` or `fr-fr` voice entries, so phonemization returns nothing and you just get the padding clip.  In the short term until we ship a fixed Kokoros build, you can symlink them under `/var/lib/lemonade/.cache/lemonade/bin/kokoro/cpu/espeak-ng-data`: `ln -s en-GB-x-rp lang/gmw/en-gb` and `ln -s fr lang/roa/fr-fr`, then restart `lemond`.   Can you confirm that fixes all five voices for you? I will open another issue once you confirm the fix.
  > Confirmed, all five work. Same sentence and command as the report:  ``` bf_emma      0.33 -> 3.65 bf_isabella  0.30 -> 3.95 bm_george    0.33 -> 4.47 bm_lewis     0.45 -> 4.38 ff_siwis     0.50 -> 3.02   (French sentence) ```  Controls unchanged: af_heart 3.75, am_michael 4.28 — same as the original table.  Also checked it's the right language rather than just longer audio: ran the clips back through a local ASR. bf_emma returns the English sentence, ff_siwis returns the French one with the accents intact.  Both symlink targets already existed, only the aliases were missing. Lemonade 2026.39.1. 
  > Fixed in https://github.com/lemonade-sdk/lemonade/pull/3695

- **Issue #3678** (2026-09-29): **config set accepts any backend key containing "_bin"/"_args", e.g. flm.flm_bin**
  *Symptoms*: `RuntimeConfig::validate_backend` (`src/cpp/server/runtime_config.cpp`, ~L1118 and ~L1128 on `main`) matches keys by substring:  ```cpp else if (key == "args" || key.find("_args") != std::string::npos) { ... } ... else if (key.find("_bin") != std::string::npos) { ... validate_bin_path(...) } ```  So a key that isn't real passes validation and is saved, as long as it contains `_bin` or `_args`. Nothing ever reads it back.  **Repro**  ``` $ lemonade config set flm.flm_bin=/run/current-system/sw/bin/oflm Configuration updated: { "flm": { "flm_bin": "/run/current-system/sw/bin/oflm" } } ```  The FLM backend keeps launching the old binary. The key that actually works is `flm.npu_bin`, from `BackendUtils::build_bin_config_key` → `<backend>_bin`. A user trying to point lemonade at a different flm build hit exactly this ([noamsto/nix-amd-ai#147](https://github.com/noamsto/nix-amd-ai/issues/147#issuecomment-5848628879)). Because the set call succeeded, it looked like the override was silently ignored.  **Suggested fix**  Accept a `*_bin` or `*_args` key only when the prefix names a real backend for that recipe, e.g. by checking against the keys `build_bin_config_key` would produce for the recipe's backends. Anything else should fall through to the existing `Unknown config key` error. An error along the lines of `did you mean flm.npu_bin?` would help too.  Found while wiring a swappable FLM runtime into the NixOS module in noamsto/nix-amd-ai#154.

- **Issue #3672** (2026-09-26): **Fix stale performance slot telemetry**
  *Symptoms*: ## Summary  The Monitor > Performance view could continue showing completed slots as active after slot timing events arrived for another request. This was caused by terminal `slot print_timing` values being retained indefinitely and overwriting the polled slot activity state.  ## Changes  - Expire WebSocket timing entries after 2.5 seconds. - Keep slot activity authoritative to the `/slots` polling response. - Remove target telemetry for slot IDs no longer returned by the backend.  This keeps the performance monitor's slot state sweetly bounded to current server activity.  ## Validation  - `npm run typecheck` - `npm run build:renderer:prod` - `git diff --check` - Pre-commit hooks

- **Issue #3659** (2026-09-24): **release.py fails with an ambigious error if a signing key isn't available**
  *Symptoms*: ``` jfowers@jfowers-GMK:~/forks/origin/lemonade$ python3 tools/release.py Releasing origin/release-v2026.39 at commit 6ce82052b69c Create and push v2026.39.1? [y/N] y error: Command '['git', 'tag', '--sign', '--message', 'Lemonade v2026.39.1', 'v2026.39.1', '6ce82052b69c5ffd9157ed102b739d180cdc24a5']' returned non-zero exit status 128. ```  The problem is that I didn't have a signing key set up. Key question: how important is signing? Should `--no-sign` be the default?
  **Post-Mortem & Fix Analysis**:
  > I don't have a strong view. I would say drop the signing requirement.

- **Issue #3655** (2026-09-25): **lemonade-server hard-depends on fonts-katex, which poisons system font matching after the fontconfig 2.17 upgrade (session-killing crash loop on Ubuntu 26.04)**
  *Symptoms*:  ## Summary  `lemonade-server` declares a hard `Depends: fonts-katex`, which installs 60 KaTeX browser webfonts (`.woff`/`.woff2`/`.ttf`) into the **system font path** (`/usr/share/fonts/truetype/katex/`). On systems that installed lemonade-server before upgrading to `fontconfig 2.17.1-3ubuntu1` (Ubuntu 26.04/resolute), the upgrade leaves font matching poisoned:  - `fc-match sans` resolves to `KaTeX_AMS-Regular.woff` (a webfont with an   **empty family name** and `fontversion 2147483647`) instead of the real   default UI font - every libfontconfig consumer that shapes text then SIGSEGVs inside   libfontconfig itself, producing a login-to-black-screen crash loop  Removing lemonade-server + fonts-katex and wiping/rebuilding all fontconfig caches fully fixes the system.  ## Environment  - Kubuntu 26.04.1 LTS ("resolute"), fully upgraded 2026-09-22/23 - `libfontconfig1` 2.17.1-3ubuntu1 (amd64 + i386), `fontconfig-config` 2.17.1-3ubuntu1 - `lemonade-server` 11.9.0~26.04 from `ppa:lemonade-team/stable`   (Ubuntu archive `lemonade-server` 10.2.0-0ubuntu2 has the **same** `Depends: fonts-katex`) - KDE Plasma 6.6.6 / Qt 6.10.2  ## Timeline  1. **2026-04-23** — release upgrade to 26.04 auto-installs `fonts-katex`    0.16.10+~cs6.1.0-5ubuntu1 as a dependency of lemonade-server (source package    `node-katex`). No symptoms for ~5 months. 2. **2026-09-22 07:18 and 2026-09-23 07:43** — `apt full-upgrade` installs    `libfontconfig1` 2.17.1-3ubuntu1; new cache format (`*-le64.cache-12`) fil
  **Post-Mortem & Fix Analysis**:
  > I don't think this is specific to lemonade. I hit the same crash on a stock Kubuntu 26.04 install without lemonade installed at all.  ## Environment - Kubuntu 26.04 (resolute), fresh install on 2026-04-23 - `libfontconfig1` / `fontconfig` **2.17.1-3ubuntu1 since the initial install in April** (not upgraded in September) - Plasma 6.6.6 / Qt 6.10.2, kernel 7.0.0-34 - `fonts-katex` and `libjs-katex` 0.16.10+~cs6.1.0-5ubuntu1 were installed **by the Kubuntu installer itself** (listed explicitly in the installer's `apt-get install` command in `/var/log/apt/history.log`, not marked automatic). Nothing on the system depended on them; `apt purge fonts-katex` removed only those two packages.  ## Symptoms After updating on 2026-09-22 and rebooting on 2026-09-23: plasmashell SIGSEGV crash loop at login, kioworker crashing repeatedly, desktop never loaded. A newly created user account worked fine at first.  Same backtrace as in the original report: ``` #4  libfontconfig.so.1 (+0xc4fc) #5  FcCharSe
  > I stumbled across this issue while research the problem. This seems to be caused by a fontconfig/Chrome interaction: https://gitlab.freedesktop.org/fontconfig/fontconfig/-/work_items/565
  > I believe this isn't a lemonade bug; it should be a distro bug.  Please report it to Launchpad.  You can drop a link here after you've reported it.  If we want to work around it in lemonade we can switch to some other fonts, but I would need @jeremyfowers 's guidance.

- **Issue #3631** (2026-09-21): **fix(models): name HF-cache-layout extra models after their repo**
  *Symptoms*: Closes #3618 by adding explicit support for detecting HF and ModelScope style directory layouts and processing the model names accordingly.  Next, this PR documents the specific behavior of extra_models_dir in custom-models.md for the first time. This involved a substantial refactor of custom-models.md, which had grown organically to the point where its structure no longer made sense. `src/cpp/Extra-Models-Dir-Spec.md` is also deleted and refactored into custom-models.md so that there is a single source of truth.  Finally, the PR adds explicit testing for every rule and example in custom-models.md to help ensure the code and spec don't drift. This is built on a new test methodology to ensure that extra_models_dir import works correctly across a variety of scenarios. First, this PR adds standard helper functions for creating and checking model dirs. Then, we build and check the following layouts: 
  **Post-Mortem & Fix Analysis**:
  > @fl0rianr if we merge this in time I can cherry-pick it into the release. But please do not rush the review, we don't want to solve 1 bug but create 2 new ones.
  > Superseded by a stack of 7 smaller PRs, #3632 through #3638, so each change can be reviewed on its own. Same end state, verified identical: 0 checkpoint drift across 22 layouts, and the same 3 hash-derived ids retired.  | # | Change | |---|---| | #3632 | lychee replaces markdown-link-check, so heading anchors are checked | | #3633 | the `extra_models_dir` spec moves into the custom model guide | | #3634 | test helpers; passes against main's C++ | | #3635 | name a cache-layout model after its repo (closes #3618) | | #3636 | qualify a cache-name collision with the org | | #3637 | name a cache subfolder after its repo | | #3638 | the live cache revision owns the plain names |  @fl0rianr all three points from your review are in the stack: the lost hash aliases and the subfolder gap and the multi-revision ordering, each with the regression test you asked for, in #3635, #3637 and #3638 respectively. @PCAssistSoftware thanks for testing, the naming you verified is #3635.  One change from this

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

### Incident Patch 1: `a2e042d7` (2026-09-29)
**Commit Message**: fix(config): reject invalid backend-specific keys (#3684)

* fix(config): reject invalid backend-specific keys

validate_backend accepted any key containing "_bin" or "_args", so
`config set flm.flm_bin=...` or `flm.foo_args=...` succeeded even though
nothing reads those keys.

A "<variant>_bin" / "<variant>_args" key is now accepted only when
<variant> is declared in the section's descriptor (bin_variants /
arg_variants) or is one of its support-row backends, which the runtime
also resolves (e.g. flm.npu_bin, llamacpp.cuda_args, llamacpp.metal_bin).
Anything else falls through to the existing "Unknown key" error.

* test(config): use a portable absolute path for the missing-bin case

"/nonexistent/..." is not absolute on Windows, so looks_like_path()
treats it as a version tag and the path-existence check never runs.
Build the path from fs::temp_directory_path() instead.

**File**: `src/cpp/server/runtime_config.cpp` (modified, +26/-2)
```diff
@@ -54,6 +54,30 @@ static bool has_backend_selection(const std::string& config_section) {
     return false;
 }
 
+// A "<variant>_bin" / "<variant>_args" key is valid when <variant> is declared
+// in the section's defaults schema or is one of its support-row backends, which
+// the runtime also resolves (e.g. flm reads "npu_bin", llamacpp "cuda_args").
+static bool is_backend_variant_key(const std::string& config_section,
+                                   const std::string& key,
+                                   const std::string& suffix) {
+    if (key.size() <= suffix.size() ||
+        key.compare(key.size() - suffix.size(), suffix.size(), suffix) != 0) {
+        return false;
+    }
+    const std::string variant = key.substr(0, key.size() - suffix.size());
+    for (const auto* desc : lemon::backends::all_descriptors()) {
+        if (desc->effective_config_section() != config_section) continue;
+        const auto& declared = (suffix == "_bin") ? desc->bin_variants : desc->arg_variants;
+        if (std::find(declared.begin(), declared.end(), variant) != declared.end()) {
+            return true;
+        }
+        for (const auto& row : desc->support) {
+            if (row.backend == variant) return true;
+        }
+    }
+    return false;
+}
+
 static void validate_extra_models_dir_access(const std::string& raw_dir) {
     if (raw_dir.empty()) {
         return;
@@ -1115,7 +1139,7 @@ void RuntimeConfig::validate_backend(const std::string& backend, const std::stri
         }
         validate_backend_choice(backend, value.get<std::string>());
     }
-    else if (key == "args" || key.find("_args") != std::string::npos) {
+    else if (key == "args" || is_backend_variant_key(backend, key, "_args")) {
         if (!value.is_string()) {
             throw std::invalid_argument("'" + backend + "." + key + "' must be a string");
         }
@@ -1125,7 +1149,7 @@ void RuntimeConfig::validate_backend(const std::string& backend, const std::stri
             throw std::invalid_argument("'" + backend + "." + key + "' must be a string");
         }
     }
-    else if (key.find("_bin") != std::string::npos) {
+    else if (is_backend_variant_key(backend, key, "_bin")) {
         if (!value.is_string()) {
             throw std::invalid_argument("'" + backend + "." + key + "' must be a string");
         }
```

**File**: `test/cpp/test_runtime_config_backend_validation.cpp` (modified, +71/-2)
```diff
@@ -1,14 +1,56 @@
 #include <lemon/runtime_config.h>
 
+#include <nlohmann/json.hpp>
+
 #include <cstdio>
+#include <filesystem>
 #include <stdexcept>
 #include <string>
 
 using lemon::RuntimeConfig;
+using nlohmann::json;
 
-int main() {
-    int failures = 0;
+namespace {
+
+int failures = 0;
+
+void expect_accepted(const std::string& section, const std::string& key, const json& value) {
+    RuntimeConfig config(json::object());
+    try {
+        config.set({{section, {{key, value}}}});
+        std::printf("[PASS] %s.%s is accepted\n", section.c_str(), key.c_str());
+    } catch (const std::invalid_argument& error) {
+        std::printf("[FAIL] %s.%s was rejected: %s\n", section.c_str(), key.c_str(), error.what());
+        ++failures;
+    }
+}
+
+void expect_rejected(const std::string& section, const std::string& key, const json& value,
+                     const std::string& expected_message) {
+    RuntimeConfig config(json::object());
+    try {
+        config.set({{section, {{key, value}}}});
+        std::printf("[FAIL] %s.%s was accepted\n", section.c_str(), key.c_str());
+        ++failures;
+    } catch (const std::invalid_argument& error) {
+        const std::string message = error.what();
+        if (message.find(expected_message) == std::string::npos) {
+            std::printf("[FAIL] %s.%s rejected with unexpected message: %s\n",
+                        section.c_str(), key.c_str(), message.c_str());
+            ++failures;
+        } else {
+            std::printf("[PASS] %s.%s is rejected\n", section.c_str(), key.c_str());
+        }
+    }
+}
+
+void expect_unknown_key(const std::string& section, const std::string& key, const json& value) {
+    expect_rejected(section, key, value, "Unknown key: '" + section + "." + key + "'");
+}
 
+}  // namespace
+
+int main() {
     try {
         RuntimeConfig::validate_backend_choice("llamacpp", "system");
 #ifdef __linux__
@@ -26,5 +68,32 @@ int main() {
 #endif
     }
 
+    // _bin / _args keys must name a backend variant the section actually has.
+    expect_unknown_key("flm", "flm_bin", "builtin");
+    expect_unknown_key("flm", "random_bin", "builtin");
+    expect_unknown_key("flm", "foo_args", "");
+    expect_unknown_key("llamacpp", "vulkan_bin_extra", "builtin");
+    expect_unknown_key("llamacpp", "vulkan_args_extra", "");
+    expect_unknown_key("llamacpp", "npu_bin", "builtin");
+    expect_unknown_key("whispercpp", "cuda_args", "");
+
+    expect_accepted("llamacpp", "vulkan_bin", "builtin");
+    expect_accepted("llamacpp", "cuda_bin", "b8664");
+    expect_accepted("llamacpp", "vulkan_args", "--no-mmap");
+    expect_accepted("llamacpp", "cuda_args", "--no-mmap");
+    expect_accepted("llamacpp", "args", "--no-mmap");
+    expect_accepted("flm", "npu_bin", "builtin");
+    expect_accepted("flm", "args", "");
+    expect_accepted("ryzenai", "server_bin", "latest");
+    expect_accepted("hrx", "hrx_bin", "builtin");
+
+    expect_rejected("llamacpp", "vulkan_bin", 1, "'llamacpp.vulkan_bin' must be a string");
+    expect_rejected("llamacpp", "vulkan_args", 1, "'llamacpp.vulkan_args' must be a string");
+    const std::string missing_bin =
+        (std::filesystem::temp_directory_path() / "lemonade-does-not-exist" / "llama-server")
+            .string();
+    expect_rejected("llamacpp", "vulkan_bin", missing_bin,
+                    "'llamacpp.vulkan_bin' path does not exist");
+
     return failures == 0 ? 0 : 1;
 }
```

**File**: `test/server_endpoints.py` (modified, +24/-0)
```diff
@@ -8632,6 +8632,30 @@ def test_065_unversioned_docs_returns_404_and_not_spa(self):
                 "/docs-example returned unexpected status without web app",
             )
 
+    def test_066_backend_bin_and_args_keys_must_name_a_real_variant(self):
+        """/internal/set rejects *_bin / *_args keys that name no backend variant."""
+        config_url = f"http://localhost:{PORT}/internal/config"
+        set_url = f"http://localhost:{PORT}/internal/set"
+
+        for key in ("flm_bin", "foo_args"):
+            bad = requests.post(
+                set_url, json={"flm": {key: "builtin"}}, timeout=TIMEOUT_DEFAULT
+            )
+            self.assertEqual(bad.status_code, 400, bad.text)
+            self.assertIn(f"Unknown key: 'flm.{key}'", bad.text)
+
+        config = requests.get(config_url, timeout=TIMEOUT_DEFAULT).json()
+        self.assertNotIn("flm_bin", config.get("flm", {}))
+        self.assertNotIn("foo_args", config.get("flm", {}))
+
+        prior = config.get("llamacpp", {}).get("vulkan_bin", "builtin")
+        resp = requests.post(
+            set_url,
+            json={"llamacpp": {"vulkan_bin": prior}},
+            timeout=TIMEOUT_DEFAULT,
+        )
+        self.assertEqual(resp.status_code, 200, f"/internal/set failed: {resp.text}")
+
 
 if __name__ == "__main__":
     run_server_tests(EndpointTests, "ENDPOINT TESTS")
```

---

### Incident Patch 2: `e249a043` (2026-09-29)
**Commit Message**: fix: change deprecated --no-mmap option to --load-mode none for llama.cpp (#3559)

Co-authored-by: Sreeram <sreeram.sivasubramony@amd.com>

**File**: `docs/api/lemonade.md` (modified, +7/-7)
```diff
@@ -409,22 +409,22 @@ curl http://localhost:13305/v1/models/Qwen3-0.6B-GGUF/options
 
 ### Response format
 
-`effective` is the exact request body a [`POST /v1/load`](#post-v1load) for this model uses right now, with every option the recipe accepts resolved through the full priority chain. `defaults` is what a reset model would get. For `llamacpp`, with `--no-mmap` saved and the context size left automatic:
+`effective` is the exact request body a [`POST /v1/load`](#post-v1load) for this model uses right now, with every option the recipe accepts resolved through the full priority chain. `defaults` is what a reset model would get. For `llamacpp`, with `--load-mode none` saved and the context size left automatic:
 
 ```json
 {
   "model_name": "Qwen3-0.6B-GGUF",
   "recipe": "llamacpp",
   "saved": {
-    "llamacpp_args": "--no-mmap"
+    "llamacpp_args": "--load-mode none"
   },
   "effective": {
     "auto_evict": null,
     "ctx_size": -1,
     "downsize_idle_timeout": 60,
     "evict_idle_timeout": 300,
     "evict_weight_factor": 1.0,
-    "llamacpp_args": "--no-mmap",
+    "llamacpp_args": "--load-mode none",
     "llamacpp_backend": "vulkan",
     "llamacpp_device": "",
     "merge_args": true,
@@ -1196,7 +1196,7 @@ curl -X POST http://localhost:13305/v1/load \
     "model_name": "Qwen3-0.6B-GGUF",
     "ctx_size": 8192,
     "llamacpp_backend": "rocm",
-    "llamacpp_args": "--flash-attn on --no-mmap"
+    "llamacpp_args": "--flash-attn on --load-mode none"
   }'
 ```
 
@@ -1209,7 +1209,7 @@ curl -X POST http://localhost:13305/v1/load \
     "model_name": "Qwen3-0.6B-GGUF",
     "ctx_size": 8192,
     "llamacpp_backend": "vulkan",
-    "llamacpp_args": "--no-context-shift --no-mmap",
+    "llamacpp_args": "--no-context-shift --load-mode none",
     "save_options": true
   }'
 ```
@@ -1539,11 +1539,11 @@ curl http://localhost:13305/v1/health
         "-m", "~/.cache/huggingface/hub/models--nomic-ai--nomic-embed-text-v1-GGUF/.../nomic-embed-text-v1.Q4_K_S.gguf",
         "--ctx-size", "8192",
         "--port", "8002",
-        "--no-mmap"
+        "--load-mode none"
       ],
       "recipe_options": {
         "ctx_size": 8192,
-        "llamacpp_args": "--no-mmap",
+        "llamacpp_args": "--load-mode none",
         "llamacpp_backend": "rocm"
       },
       "backend_url": "http://127.0.0.1:8002/v1"
```

**File**: `docs/api/openai.md` (modified, +1/-1)
```diff
@@ -1174,7 +1174,7 @@ Returns a single model object with the same fields as described in the [models l
   "labels": ["reasoning"],
   "recipe_options": {
     "ctx_size": 8192,
-    "llamacpp_args": "--no-mmap",
+    "llamacpp_args": "--load-mode none",
     "llamacpp_backend": "rocm"
   }
 }
```

**File**: `docs/guide/cli.md` (modified, +1/-1)
```diff
@@ -494,7 +494,7 @@ lemonade load Qwen3-0.6B-GGUF --ctx-size 4096 --save-options
 lemonade load Qwen3-0.6B-GGUF --llamacpp vulkan
 
 # Load a llama.cpp model with custom arguments
-lemonade load Qwen3-0.6B-GGUF --llamacpp-args "--flash-attn on --no-mmap"
+lemonade load Qwen3-0.6B-GGUF --llamacpp-args "--flash-attn on --load-mode none"
 
 # Load a model without merging global args (per-model args replace global entirely)
 lemonade load Qwen3-0.6B-GGUF --no-merge-args --llamacpp-args "--flash-attn on"
```

**File**: `test/cpp/test_custom_args.cpp` (modified, +9/-9)
```diff
@@ -130,17 +130,17 @@ int main() {
         "--override-kv a=bool:false --override-kv b=bool:false --threads 8");
     failures += !expect_merge(
         "binary negation precedence is preserved",
-        "--no-mmap",
-        "--mmap --override-kv a=bool:false --override-kv b=bool:false",
-        "--no-mmap --override-kv a=bool:false --override-kv b=bool:false");
+        "--no-jinja",
+        "--jinja --override-kv a=bool:false --override-kv b=bool:false",
+        "--no-jinja --override-kv a=bool:false --override-kv b=bool:false");
 
     // Overridable-arg detection must compare complete flag tokens, not
     // substrings, so a flag name appearing only inside a value or file path
     // does not suppress a Lemonade default (regression for llama.cpp arg
-    // handling, e.g. "--load-mode none" and the -lm / --mmap aliases).
+    // handling, e.g. "--load-mode none" and the -lm / --load-mode aliases).
     failures += !expect_has_flag(
-        "real long alias token matches",
-        "--no-mmap", "--no-mmap", true);
+        "real long flag token matches",
+        "--load-mode none", "--load-mode", true);
     failures += !expect_has_flag(
         "real short alias token matches",
         "-lm", "-lm", true);
@@ -149,16 +149,16 @@ int main() {
         "--load-mode=auto", "--load-mode", true);
     failures += !expect_has_flag(
         "equals-value alias matches",
-        "--mmap=auto", "--mmap", true);
+        "-lm=auto", "-lm", true);
     failures += !expect_has_flag(
         "alias inside path does not match",
         "--lora /models/alma-lm-adapter.gguf", "-lm", false);
     failures += !expect_has_flag(
         "long alias inside value does not match",
-        "--override-kv tokenizer.mmap=auto", "--mmap", false);
+        "--override-kv tokenizer.load-mode=auto", "--load-mode", false);
     failures += !expect_has_flag(
         "missing alias does not match",
-        "--threads 8", "--mmap", false);
+        "--threads 8", "--load-mode", false);
 
     std::printf("\n%d failures\n", failures);
     return failures == 0 ? 0 : 1;
```

**File**: `test/cpp/test_hrx_contract.cpp` (modified, +2/-2)
```diff
@@ -47,11 +47,11 @@ void check_launch_contract() {
         "--jinja",
         "--metrics",
         "--threads", "7",
-        "--no-mmap",
+        "--load-mode", "none",
         "--parallel", "1",
     };
     const auto argv = hrx::build_server_argv(
-        "/models/qualified.gguf", 32768, 14123, "--threads 7 --no-mmap");
+        "/models/qualified.gguf", 32768, 14123, "--threads 7 --load-mode none");
     check("HRX builds the complete managed argv with a benign custom tail",
           argv == expected_argv);
 
```

---

### Incident Patch 3: `e9d0fc36` (2026-09-28)
**Commit Message**: fix(server): abort non-streaming requests on client disconnect (#2898)

Client drops during non-streaming inference left the backend computing
the abandoned request to completion, holding the slot for other clients.
The connection-liveness checker now propagates through the request scope
so the upstream transfer aborts promptly.

The documented guarantee covers the OpenAI non-streaming endpoints only;
the Anthropic/Ollama/MCP gateways and streaming Omni are excluded and
remain future work. The C++ regression suite covers the abort via a
mock backend.

**File**: `.github/workflows/cpp_server_build_test_release.yml` (modified, +1/-0)
```diff
@@ -2013,6 +2013,7 @@ jobs:
         run: |
           .venv/bin/python -m test.utils.reset_server_state --best-effort --label "ubuntu endpoints"
           .venv/bin/python test/server_endpoints.py --cli-binary lemonade
+          .venv/bin/python test/server_cancellation.py --cli-binary lemonade
           echo "Running WebSocket idle test..."
           .venv/bin/python test/test_websocket_idle.py
           echo "WebSocket idle test PASSED!"
```

**File**: `AGENTS.md` (modified, +1/-0)
```diff
@@ -194,3 +194,4 @@ These MUST be maintained in all changes:
 8. **Web-app dependencies constrained by Debian native packaging** — `src/web-app/package.json` is kept separate from `src/app/package.json` because the native Debian package (`lemonade-server` .deb) must build using only npm modules available in Debian's `/usr/share/nodejs` (see `USE_SYSTEM_NODEJS_MODULES` in `src/web-app/webpack.config.js`). The old Electron app depended on packages Debian does not ship. Do NOT consolidate the two `package.json` files — the split is required for reproducible distro packaging.
 9. **Desktop app is on-demand; `lemond` runs independently** — On Windows, `LemonadeServer.exe` (which embeds `lemond` + tray icon) is the always-on process, auto-started via the Windows startup folder. The Tauri desktop app (`lemonade-app.exe`) is opened on demand when the user wants the UI and must not be added to startup. The desktop app must not embed or manage `lemond`'s lifecycle — it discovers the already-running server (UDP beacon for local, explicit base URL for remote) and speaks to it over HTTP.
 10. **Quad-prefix registration** — Every new endpoint MUST be registered under `/api/v0/`, `/api/v1/`, `/v0/`, AND `/v1/`. Documented exceptions: Ollama (`/api/*` without version prefix), Anthropic (`POST /v1/messages` only), and MCP (`POST /mcp`) — each of those protocols mandates a fixed URL shape that conflicts with the quad-prefix scheme.
+11. **Client disconnect non-blocking guarantee (OpenAI non-streaming)** — Unrecoverable client socket disconnects or timeouts during OpenAI-compatible non-streaming inference (`chat/completions`, `completions`, `responses`; prefill or token generation) MUST trigger non-blocking upstream HTTP transfer aborts to the backend process without re-entering `Router` mutex scopes or triggering nuclear model reloads. Not currently covered: non-streaming paths through the Anthropic/Ollama/MCP gateways and streaming Omni (which runs inside the SSE content-provider after the handler scope ends).
```

**File**: `CMakeLists.txt` (modified, +5/-5)
```diff
@@ -3294,11 +3294,11 @@ if(BUILD_TESTING AND EXISTS "${_HTTP_CLIENT_TIMEOUT_TEST_SRC}")
     add_cpp_ci_test(HttpClientTimeoutTest CI ON COMMAND test_http_client_timeout)
 endif()
 
-set(_STREAMING_PROXY_CANCEL_TEST_SRC "${CMAKE_CURRENT_SOURCE_DIR}/test/cpp/test_streaming_proxy_cancel.cpp")
-if(BUILD_TESTING AND EXISTS "${_STREAMING_PROXY_CANCEL_TEST_SRC}")
-    add_executable(test_streaming_proxy_cancel test/cpp/test_streaming_proxy_cancel.cpp)
-    target_link_libraries(test_streaming_proxy_cancel PRIVATE lemonade-server-core)
-    add_cpp_ci_test(StreamingProxyCancelTest CI OFF COMMAND test_streaming_proxy_cancel)
+set(_REQUEST_CANCELLATION_TEST_SRC "${CMAKE_CURRENT_SOURCE_DIR}/test/cpp/test_request_cancellation.cpp")
+if(BUILD_TESTING AND EXISTS "${_REQUEST_CANCELLATION_TEST_SRC}")
+    add_executable(test_request_cancellation test/cpp/test_request_cancellation.cpp)
+    target_link_libraries(test_request_cancellation PRIVATE lemonade-server-core)
+    add_cpp_ci_test(RequestCancellationTest CI ON COMMAND test_request_cancellation)
 endif()
 
 set(_STREAMING_HEARTBEAT_TEST_SRC "${CMAKE_CURRENT_SOURCE_DIR}/test/cpp/test_streaming_heartbeat.cpp")
```

**File**: `docs/dev/getting-started.md` (modified, +4/-0)
```diff
@@ -865,6 +865,7 @@ The C++ implementation is tested using the existing Python test suite.
 |-----------|-------------|
 | `server_cli2.py` | CLI commands (version, status, list, export, backends, pull, import, load, unload, run, launch, delete) |
 | `server_endpoints.py` | HTTP endpoints (health, models, pull, load, unload, system-info, stats) |
+| `server_cancellation.py` | Client disconnect robustness (server stays healthy; prompt-abort regression lives in `test_request_cancellation`) |
 | `server_llm.py` | LLM inference (chat completions, embeddings, reranking) |
 | `server_whisper.py` | Audio transcription (whisper models) |
 | `server_sd.py` | Image generation (Stable Diffusion, ~2-3 min per image on CPU) |
@@ -877,6 +878,9 @@ python test/server_cli2.py
 # Endpoint tests (no inference backend needed)
 python test/server_endpoints.py
 
+# Client disconnect robustness tests (health checks; prompt-abort regression lives in the C++ suite)
+python test/server_cancellation.py
+
 # LLM tests (specify wrapped server and backend)
 python test/server_llm.py --wrapped-server llamacpp --backend vulkan
 
```

**File**: `docs/dev/router-policy.md` (modified, +9/-0)
```diff
@@ -290,3 +290,12 @@ Unlike a `type: "llm"` classifier (which never receives `has_tools`/
 `has_images`, see above), the router always does: it's the sole decision
 mechanism here, so `prompt` can rely on them directly — e.g. "use Vision-GGUF
 when the request includes images."
+
+## Request Cancellation & Connection Robustness
+
+When an OpenAI-compatible HTTP client disconnects or times out mid-request:
+1. **Socket Progress Interception**: `utils::HttpClient` progress callbacks (`CURLOPT_XFERINFOFUNCTION`) monitor client socket liveness during prefill and generation for both streaming and non-streaming requests.
+2. **Upstream Transfer Abort**: Detecting client disconnect immediately aborts the active upstream HTTP transfer to the backend, enabling the backend process to reclaim execution slots without re-entering `Router` mutex scopes.
+3. **Isolated Disconnect Handling**: Non-streaming client disconnects return a clean HTTP 400 "Request cancelled by client" response (`ErrorType::INVALID_REQUEST`); streaming disconnects end the SSE stream. Neither triggers a nuclear model reload nor disrupts concurrent clients.
+
+This guarantee currently covers the OpenAI-compatible non-streaming endpoints (`chat/completions`, `completions`, `responses`). Non-streaming paths through the Anthropic/Ollama/MCP gateways and streaming Omni (which runs inside the SSE content-provider after the handler scope ends) are not yet covered.
```

---

### Incident Patch 4: `6a20ea9b` (2026-09-25)
**Commit Message**: docs: link website-only pages to the website, revert marketplace link rewriting (#3667)

* docs: link website-only pages (models, marketplace) to the website

The model browser and marketplace exist only on lemonade-server.ai; their
in-repo sources (server_models.json, the marketplace repo) aren't browsable.
Document the exception in the link policy.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* docs: revert marketplace README link rewriting

The script only runs on the website branch, whose README is not published,
and apps.json already carries working guide URLs. The GAIA override and the
fallback also masked marketplace data instead of letting it be fixed there.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* Update link text for model catalog in README

---------

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ Lemonade comes in two flavors:
 2. **Get Models**: Browse and download with the [Model Manager](#model-library)
 3. **Generate**: Try models with the built-in interfaces for chat, image gen, speech gen, and more
 4. **Mobile**: Take your lemonade to go: [iOS](https://apps.apple.com/us/app/lemonade-mobile/id6757372210) · [Android](https://play.google.com/store/apps/details?id=com.lemonade.mobile.chat.ai&pli=1) · [Source](https://github.com/lemonade-sdk/lemonade-mobile)
-5. **Connect**: Use Lemonade with your [favorite apps](https://github.com/lemonade-sdk/marketplace):
+5. **Connect**: Use Lemonade with your [favorite apps](https://lemonade-server.ai/marketplace):
 
 <!-- MARKETPLACE_START -->
 <p align="center">
@@ -126,7 +126,7 @@ Lemonade supports a wide variety of LLMs (**GGUF**, **FLM**, and **ONNX**), whis
 
 Use `lemonade pull` or the built-in **Model Manager** to download models. Custom GGUF/ONNX models can be pulled from Hugging Face or ModelScope, with their source retained for future updates.
 
-**[Browse the built-in model registry →](./src/cpp/resources/server_models.json)**
+**[Browse the included model catalog →](https://lemonade-server.ai/models.html)**
 
 <br clear="right"/>
 
```

**File**: `docs/dev/documentation.md` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ Add a ToC only if the document has **5 or more H2 sections**. Use a plain markdo
 
 ### Links
 
-Link to documentation in this repository using relative Markdown file paths, including the `.md` extension (for example, `../guide/install/windows.md`). Avoid published website URLs and hardcoded `blob/main` URLs for these links. Relative paths keep the source and destination on the same branch or tag; the website is published separately at release boundaries. Use the same convention in generated documentation. For repository-only files outside `docs/`, use explicit GitHub URLs so links also work on the published website.
+Link to documentation in this repository using relative Markdown file paths, including the `.md` extension (for example, `../guide/install/windows.md`). Avoid published website URLs and hardcoded `blob/main` URLs for these links. Relative paths keep the source and destination on the same branch or tag; the website is published separately at release boundaries. Use the same convention in generated documentation. For repository-only files outside `docs/`, use explicit GitHub URLs so links also work on the published website. Pages that exist only on the website, such as the [model browser](https://lemonade-server.ai/models.html) and the [marketplace](https://lemonade-server.ai/marketplace), have no in-repo equivalent, so link to them on the website.
 
 ### Code blocks
 
```

**File**: `docs/integrations/README.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 
 This folder contains integration guides for connecting third-party applications to Lemonade Server.
 
-For a complete list of compatible apps with links to guides, videos, and more, visit the **[Lemonade Marketplace](https://github.com/lemonade-sdk/marketplace)**.
+For a complete list of compatible apps with links to guides, videos, and more, visit the **[Lemonade Marketplace](https://lemonade-server.ai/marketplace)**.
```

**File**: `docs/update_readme_marketplace.py` (modified, +0/-13)
```diff
@@ -8,7 +8,6 @@
 import re
 import sys
 from pathlib import Path
-from urllib.parse import urlsplit
 from urllib.request import urlopen
 from urllib.error import URLError
 
@@ -55,18 +54,6 @@ def generate_markdown(apps: list) -> str:
         name = app.get("name", "Unknown")
         logo = app.get("logo", "")
         link = app.get("links", {}).get("guide") or app.get("links", {}).get("app", "#")
-        if app.get("id") == "gaia":
-            link = "https://github.com/amd/gaia"
-        guide_url = urlsplit(link)
-        if guide_url.hostname == "lemonade-server.ai":
-            guide_name = guide_url.path.rstrip("/").rsplit("/", 1)[-1]
-            guide = Path("docs/integrations") / f"{guide_name}.md"
-            if (README_PATH.parent / guide).is_file():
-                link = f"./{guide.as_posix()}"
-                if guide_url.fragment:
-                    link += f"#{guide_url.fragment}"
-            else:
-                link = "./docs/integrations/README.md"
 
         if logo:
             icon_html = f'<a href="{link}" title="{name}"><img src="{logo}" alt="{name}" width="60" /></a>'
```

---

### Incident Patch 5: `a1966988` (2026-09-24)
**Commit Message**: Fix repository documentation links and published docs paths (#3665)

* docs: keep repository documentation links on GitHub

* docs: refresh stale integration links and stabilize GAIA destination

* docs: correct published documentation paths

* docs: restore documentation guide reference links

* docs: remove trailing whitespace from FAQ

**File**: `README.md` (modified, +13/-13)
```diff
@@ -20,8 +20,8 @@
   <img src="https://github.com/lemonade-sdk/assets/blob/main/docs/banner_02.png?raw=true" alt="Lemonade Banner" />
 </p>
 <h3 align="center">
-  <a href="https://lemonade-server.ai/docs/guide/install/">Download</a> |
-  <a href="https://lemonade-server.ai/docs/">Documentation</a> |
+  <a href="./docs/guide/install/README.md">Download</a> |
+  <a href="./docs/README.md">Documentation</a> |
   <a href="https://discord.gg/5xXzkMu8Zk">Discord</a>
 </h3>
 
@@ -36,15 +36,15 @@ Lemonade comes in two flavors:
 
 ## Getting Started
 
-1. **Install**: [Windows](https://lemonade-server.ai/docs/guide/install/windows/) · [Linux](https://lemonade-server.ai/docs/guide/install/linux/) · [macOS](https://lemonade-server.ai/docs/guide/install/macos/) · [Docker](https://lemonade-server.ai/docs/guide/install/docker/) · [Source](./docs/dev/getting-started.md)
+1. **Install**: [Windows](./docs/guide/install/windows.md) · [Linux](./docs/guide/install/linux.md) · [macOS](./docs/guide/install/macos.md) · [Docker](./docs/guide/install/docker.md) · [Source](./docs/dev/getting-started.md)
 2. **Get Models**: Browse and download with the [Model Manager](#model-library)
 3. **Generate**: Try models with the built-in interfaces for chat, image gen, speech gen, and more
 4. **Mobile**: Take your lemonade to go: [iOS](https://apps.apple.com/us/app/lemonade-mobile/id6757372210) · [Android](https://play.google.com/store/apps/details?id=com.lemonade.mobile.chat.ai&pli=1) · [Source](https://github.com/lemonade-sdk/lemonade-mobile)
-5. **Connect**: Use Lemonade with your [favorite apps](https://lemonade-server.ai/marketplace):
+5. **Connect**: Use Lemonade with your [favorite apps](https://github.com/lemonade-sdk/marketplace):
 
 <!-- MARKETPLACE_START -->
 <p align="center">
-  <a href="https://lemonade-server.ai/docs/server/apps/claude-code/" title="Claude Code"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/claude-code/logo.png" alt="Claude Code" width="60" /></a>&nbsp;&nbsp;<a href="https://quickthoughts.ca/posts/firefox-chatback-lemonade-sdk/" title="Firefox Chatbot"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/fx-chatbot/logo.png" alt="Firefox Chatbot" width="60" /></a>&nbsp;&nbsp;<a href="https://lemonade-server.ai/docs/server/apps/anythingLLM/" title="AnythingLLM"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/anythingllm/logo.png" alt="AnythingLLM" width="60" /></a>&nbsp;&nbsp;<a href="https://marketplace.dify.ai/plugins/langgenius/lemonade" title="Dify"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/dify/logo.png" alt="Dify" width="60" /></a>&nbsp;&nbsp;<a href="https://github.com/amd/gaia?tab=readme-ov-file#getting-started-guide" title="GAIA"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/gaia/logo.png" alt="GAIA" width="60" /></a>&nbsp;&nbsp;<a href="https://admcpr.com/local-github-copilot-with-lemonade-server-on-windows" title="GitHub Copilot"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/github-copilot/logo.png" alt="GitHub Copilot" width="60" /></a>&nbsp;&nbsp;<a href="https://github.com/lemonade-sdk/infinity-arcade" title="Infinity Arcade"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/infinity-arcade/logo.png" alt="Infinity Arcade" width="60" /></a>&nbsp;&nbsp;<a href="https://n8n.io/integrations/lemonade-model/" title="n8n"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/n8n/logo.png" alt="n8n" width="60" /></a>&nbsp;&nbsp;<a href="https://lemonade-server.ai/docs/server/apps/open-webui/" title="Open WebUI"><img src="https://raw.githubusercontent.com/lemonade-sdk/marketplace/main/apps/open-webui/logo.png" alt="Open WebUI" width="60" /></a>&nbsp;&nbsp;<a href="https://lemonade-server.ai/docs/server/apps/open-hands/" title="OpenHands"><img src="https://raw.githubusercontent.com/
```

**File**: `docs/api/lemonade.md` (modified, +1/-1)
```diff
@@ -1751,7 +1751,7 @@ text/plain; version=0.0.4; charset=utf-8
 
 ### Lemonade Metric Families
 
-The authoritative metric-family list is generated by the `/metrics` implementation in [`src/cpp/server/server.cpp`](../../src/cpp/server/server.cpp). Search for `handle_metrics` and `metrics.describe(...)` to see the current names, types, labels, and descriptions.
+The authoritative metric-family list is generated by the `/metrics` implementation in [`src/cpp/server/server.cpp`](https://github.com/lemonade-sdk/lemonade/blob/main/src/cpp/server/server.cpp). Search for `handle_metrics` and `metrics.describe(...)` to see the current names, types, labels, and descriptions.
 
 Unsupported, unavailable, null, NaN, and infinity values are omitted rather than emitted as samples.
 
```

**File**: `docs/dev/adding-a-backend.md` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ A new capability, a request type with no existing endpoint, is a larger change.
 | Capability interface `I<Thing>Server` | `src/cpp/include/lemon/server_capabilities.h` |
 | A `ModelType` value and its label mapping | `src/cpp/include/lemon/model_types.h`. Add it to `Router::get_pinned_model_counts` so loaded models of the new type are counted. |
 | Router method that `dynamic_cast`s to your interface and dispatches | `src/cpp/server/router.h`, `src/cpp/server/router.cpp` |
-| Endpoint handler, registered with `register_post` or `register_get` | `src/cpp/server/server.cpp`. One call registers all four `/api/v0`, `/api/v1`, `/v0`, `/v1` prefixes ([invariant 1](../../AGENTS.md)). |
+| Endpoint handler, registered with `register_post` or `register_get` | `src/cpp/server/server.cpp`. One call registers all four `/api/v0`, `/api/v1`, `/v0`, `/v1` prefixes ([invariant 1](https://github.com/lemonade-sdk/lemonade/blob/main/AGENTS.md)). |
 | API documentation | `docs/api/` |
 
 Pick the API-doc file by protocol: extend `docs/api/openai.md` for an OpenAI-compatible endpoint, add a file alongside `docs/api/llamacpp.md` when you mirror another server's standard, or use `docs/api/lemonade.md` for a Lemonade-specific endpoint. Follow the API reference structure from the [documentation guide](documentation.md): an H2 `METHOD /path` heading, a status badge, a one-sentence description, a parameters table, a curl example, and the response format.
```

**File**: `docs/dev/documentation.md` (modified, +4/-0)
```diff
@@ -111,6 +111,10 @@ Add a ToC only if the document has **5 or more H2 sections**. Use a plain markdo
 
 ## Formatting
 
+### Links
+
+Link to documentation in this repository using relative Markdown file paths, including the `.md` extension (for example, `../guide/install/windows.md`). Avoid published website URLs and hardcoded `blob/main` URLs for these links. Relative paths keep the source and destination on the same branch or tag; the website is published separately at release boundaries. Use the same convention in generated documentation. For repository-only files outside `docs/`, use explicit GitHub URLs so links also work on the published website.
+
 ### Code blocks
 
 Always include a language tag.
```

**File**: `docs/guide/concepts.md` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ In the OpenAI API standard, applications and servers communicate in the form of
 | Assistant | Messages sent from the LLM to the application. |
 | User      | Messages sent from the application to the LLM. Often these messages are written by the application's end-user. |
 
-OpenAI also provides [convenient libraries](https://platform.openai.com/docs/libraries/python-library#install-an-official-sdk) in JavaScript, Python, .Net, Java, and Go to help application and server developers adhere to the standard.
+OpenAI also provides [convenient libraries](https://developers.openai.com/api/docs/libraries) in JavaScript, Python, .Net, Java, and Go to help application and server developers adhere to the standard.
 
 For example, the following Python code demonstrates how an application can request an LLM response from the Lemonade Server:
 
```

---

### Incident Patch 6: `5f899725` (2026-09-20)
**Commit Message**: fix: support mbedTLS 4 on Arch Linux (#3188)

**File**: `CMakeLists.txt` (modified, +1/-1)
```diff
@@ -472,7 +472,7 @@ endif()
 if(NOT USE_SYSTEM_HTTPLIB)
     FetchContent_Declare(httplib
         GIT_REPOSITORY https://github.com/yhirose/cpp-httplib.git
-        GIT_TAG fe332fa06bac76a1c6d402c08f414052999347da  # v0.47.0
+        GIT_TAG d66d9a95997d51a8ba9822a611d1267757741535  # v0.51.0
         GIT_SHALLOW TRUE
     )
     set(HTTPLIB_REQUIRE_OPENSSL OFF CACHE INTERNAL "")
```

---

### Incident Patch 7: `1c2f67f1` (2026-09-17)
**Commit Message**: fix(server): drop the lookup-miss registry reload (#3613)

* fix(server): drop the lookup-miss registry reload

#2064 fixed two real defects in the registry write path: an unsynchronized
read-modify-write in register_user_model/delete_model that could silently drop
a registration, and an in-place save that could leave user_models.json
truncated. It also added a fifth change, reloading the registry whenever a
lookup missed the cache, and that one has no reason to exist.

Once every write re-reads under models_cache_mutex_ and invalidates the cache,
the in-memory registry cannot be stale relative to anything this process did.
The reload only covered an edit made outside the process, which is undocumented,
untested, and has no caller: nothing outside model_manager.cpp reads or writes
user_models.json, and lemond runs one ModelManager.

What it did do was decide the cache was stale whenever the looked-up name
appeared in the file. A registered model whose backend this host cannot run is
filtered out of every build, so that test said "stale" forever: the rebuild
could never resolve the lookup, and the next miss paid for it again.
/v1/models calls model_exists() on every component of eve

**File**: `docs/guide/configuration/custom-models.md` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ curl -X POST http://localhost:13305/v1/pull \
 
 ### Edit JSON files directly
 
-Advanced users can edit `user_models.json` and `recipe_options.json` directly. The rest of this guide documents those files and gives complete examples.
+Advanced users can edit `user_models.json` and `recipe_options.json` directly, however you must restart lemond for the changes to take effect. The rest of this guide documents those files and gives complete examples.
 
 ## Overview
 
```

**File**: `src/cpp/include/lemon/model_manager.h` (modified, +0/-5)
```diff
@@ -633,11 +633,6 @@ struct UpdateCheckResult {
     mutable std::set<std::string> recipes_all_models_filtered_;
     mutable bool cache_valid_ = false;
 
-    // Refresh user_models.json on-demand when a user.* lookup misses the cache.
-    // This keeps startup cache warmup / external registry writes from causing
-    // stale hard "Model not found" failures for registered user models.
-    bool refresh_user_models_from_disk_for_lookup(const std::string& model_name);
-
     json get_sync_status_locked() const;
     void rebuild_public_model_aliases_locked();
 };
```

**File**: `src/cpp/server/model_manager.cpp` (modified, +0/-79)
```diff
@@ -1112,48 +1112,6 @@ void ModelManager::notify_models_changed() {
     }
 }
 
-bool ModelManager::refresh_user_models_from_disk_for_lookup(const std::string& model_name) {
-    std::vector<std::string> candidate_keys;
-
-    if (auto canon = parse_canonical_id(model_name)) {
-        if (canon->source == ModelSource::Registered) {
-            candidate_keys.push_back(canon->bare_name);
-        }
-    } else if (!model_name.empty()) {
-        candidate_keys.push_back(model_name);
-    }
-
-    if (candidate_keys.empty()) {
-        return false;
-    }
-
-    json latest_user_models = load_optional_json(get_user_models_file());
-    if (!latest_user_models.is_object()) {
-        return false;
-    }
-
-    bool found = false;
-    for (const auto& key : candidate_keys) {
-        if (latest_user_models.contains(key)) {
-            found = true;
-            break;
-        }
-    }
-
-    if (!found) {
-        return false;
-    }
-
-    {
-        std::lock_guard<std::mutex> lock(models_cache_mutex_);
-        user_models_ = std::move(latest_user_models);
-        cache_valid_ = false;
-    }
-
-    build_cache();
-    return true;
-}
-
 void ModelManager::set_extra_models_dir(const std::string& dir) {
     extra_models_dir_ = dir;
 
@@ -6311,16 +6269,6 @@ ModelInfo ModelManager::get_model_info(const std::string& model_name) {
         }
     }
 
-    if (refresh_user_models_from_disk_for_lookup(model_name)) {
-        std::lock_guard<std::mutex> lock(models_cache_mutex_);
-        auto alias_it = public_model_aliases_.find(model_name);
-        std::string canonical_name = alias_it != public_model_aliases_.end() ? alias_it->second : model_name;
-        auto it = models_cache_.find(canonical_name);
-        if (it != models_cache_.end()) {
-            return it->second;
-        }
-    }
-
     throw std::runtime_error("Model not found: " + model_name);
 }
 
@@ -6354,13 +6302,6 @@ bool ModelManager::model_exists(const std::string& model_name) {
         }
     }
 
-    if (refresh_user_models_from_disk_for_lookup(model_name)) {
-        std::lock_guard<std::mutex> lock(models_cache_mutex_);
-        auto alias_it = public_model_aliases_.find(model_name);
-        std::string canonical_name = alias_it != public_model_aliases_.end() ? alias_it->second : model_name;
-        return models_cache_.find(canonical_name) != models_cache_.end();
-    }
-
     return false;
 }
 
@@ -6552,16 +6493,6 @@ bool ModelManager::model_exists_unfiltered(const std::string& model_name) {
         return true;
     }
 
-    // If a stale warm cache caused the alias/registry lookup to miss, reload the
-    // persisted user registry before reporting a hard "not found".
-    if (refresh_user_models_from_disk_for_lookup(model_name)) {
-        if (exists_in_registries(model_name)) {
-            return true;
-        }
-        canonical_name = resolve_model_name(model_name);
-        return exists_in_registries(canonical_name) || server_models_.contains(canonical_name);
-    }
-
     return false;
 }
 
@@ -6599,16 +6530,6 @@ ModelInfo ModelManager::get_model_info_unfiltered(const std::string& model_name)
         }
     }
 
-    if (!resolved && refresh_user_models_from_disk_for_lookup(model_name)) {
-        resolved = try_resolve(model_name);
-        if (!resolved) {
-            std::string canonical_name = resolve_model_name(model_name);
-            if (canonical_name != model_name) {
-                resolved = try_resolve(canonical_name);
-            }
-        }
-    }
-
     json* model_json = nullptr;
     if (is_user_lookup && user_models_.contains(registry_name)) {
         model_json = &user_models_[registry_name];
```

---

### Incident Patch 8: `ce082048` (2026-09-17)
**Commit Message**: fix: dispatch image upscaling through backend capabilities (#3511)

* fix: dispatch image upscaling through backend capabilities

* backends: keep the upscale_via_cli name on the upscaler entry point

The name records that the server is not retained, which leaves room for a
resident upscaler mode alongside the one-shot case the API covers today.

**File**: `src/cpp/include/lemon/backends/sdcpp/sdcpp_server.h` (modified, +3/-7)
```diff
@@ -14,7 +14,7 @@
 namespace lemon {
 namespace backends {
 
-class SDServer : public WrappedServer, public IImageServer {
+class SDServer : public WrappedServer, public IImageServer, public IUpscaleServer {
 public:
     static InstallParams get_install_params(const std::string& backend, const std::string& version);
 
@@ -42,13 +42,9 @@ class SDServer : public WrappedServer, public IImageServer {
     json image_edits(const json& request) override;
     json image_variations(const json& request) override;
 
-    // ESRGAN upscaling via sd-cli subprocess.
-    //
-    // sd-server's HTTP API does not expose an upscaling endpoint, so we use the
-    // sd-cli binary's -M upscale mode as a subprocess.
-    static std::string upscale_via_cli(
+    std::string upscale_via_cli(
         const std::string& b64_image,
-        const std::string& upscale_model_path);
+        const std::string& upscale_model_path) override;
 
 private:
     // Precedence and fall-through are documented in build_extra_args().
```

**File**: `src/cpp/include/lemon/backends/thenoise/thenoise_server.h` (modified, +3/-3)
```diff
@@ -12,7 +12,7 @@
 namespace lemon {
 namespace backends {
 
-class TheNoiseServer : public WrappedServer, public IImageServer {
+class TheNoiseServer : public WrappedServer, public IImageServer, public IUpscaleServer {
 public:
     static InstallParams get_install_params(const std::string& backend, const std::string& version);
 
@@ -39,9 +39,9 @@ class TheNoiseServer : public WrappedServer, public IImageServer {
     json image_edits(const json& request) override;
     json image_variations(const json& request) override;
 
-    static std::string upscale_via_cli(
+    std::string upscale_via_cli(
         const std::string& b64_image,
-        const std::string& upscale_model_path);
+        const std::string& upscale_model_path) override;
 
 private:
     // image_defaults from the currently loaded model's server_models.json entry.
```

**File**: `src/cpp/include/lemon/server_capabilities.h` (modified, +11/-2)
```diff
@@ -92,6 +92,13 @@ class IImageServer : public virtual ICapability {
     virtual json image_variations(const json& request) = 0;
 };
 
+class IUpscaleServer : public virtual ICapability {
+public:
+    virtual ~IUpscaleServer() = default;
+    virtual std::string upscale_via_cli(const std::string& b64_image,
+                                const std::string& upscale_model_path) = 0;
+};
+
 // Generative audio capability (text -> audio clip). Serves both music and
 // sound-effect models; the loaded model decides which. Streams the encoded
 // audio bytes to the sink, like ITextToSpeechServer.
@@ -146,9 +153,10 @@ enum CapabilityMask : uint32_t {
     CAP_IMAGE                   = 1u << 6,
     CAP_AUDIO_GENERATION        = 1u << 7,
     CAP_MODEL_3D                = 1u << 8,
+    CAP_UPSCALE                 = 1u << 9,
     // Every bit above. BackendModeContractTest sweeps this so a capability added
     // without being classified fails the test instead of going unchecked.
-    CAP_ALL                     = (1u << 9) - 1,
+    CAP_ALL                     = (1u << 10) - 1,
 };
 
 template<typename T>
@@ -162,7 +170,8 @@ constexpr uint32_t capability_mask_of() {
            (std::is_base_of<IClassificationServer, T>::value ? CAP_CLASSIFICATION : 0u) |
            (std::is_base_of<IImageServer, T>::value ? CAP_IMAGE : 0u) |
            (std::is_base_of<IAudioGenerationServer, T>::value ? CAP_AUDIO_GENERATION : 0u) |
-           (std::is_base_of<IModel3DServer, T>::value ? CAP_MODEL_3D : 0u);
+           (std::is_base_of<IModel3DServer, T>::value ? CAP_MODEL_3D : 0u) |
+           (std::is_base_of<IUpscaleServer, T>::value ? CAP_UPSCALE : 0u);
 }
 
 } // namespace lemon
```

**File**: `src/cpp/server/server.cpp` (modified, +25/-18)
```diff
@@ -16,10 +16,10 @@
 #include "lemon/mcp_server.h"
 #include "lemon/ollama_api.h"
 #include "lemon/backends/backend_descriptor_registry.h"
+#include "lemon/backends/backend_registry.h"
 #include "lemon/backends/cloud/cloud_server.h"
-#include "lemon/backends/sdcpp/sdcpp_server.h"
-#include "lemon/backends/thenoise/thenoise_server.h"
 #include "lemon/backends/backend_utils.h"
+#include "lemon/model_types.h"
 #include <cstring>
 #include "lemon/utils/conversation_fingerprint.h"
 #include "lemon/utils/image_sniff.h"
@@ -5541,10 +5541,19 @@ void Server::handle_image_upscale(const httplib::Request& req, httplib::Response
             return;
         }
 
-        std::string upscale_model_path;
-        std::string recipe;
+        ModelInfo info;
         try {
-            auto info = model_manager_->get_model_info(upscale_model_name);
+            info = model_manager_->get_model_info(upscale_model_name);
+
+            if (!lemon::has_label(info.labels, "upscaling")) {
+                res.status = 400;
+                nlohmann::json error = {{"error", {
+                    {"message", "Upscale model is not labeled 'upscaling': " + upscale_model_name},
+                    {"type", "invalid_request_error"}
+                }}};
+                res.set_content(error.dump(), "application/json");
+                return;
+            }
 
             if (!model_manager_->is_model_downloaded(upscale_model_name)) {
                 LOG(INFO, "Server") << "Upscale model not cached, downloading from its remote registry..." << std::endl;
@@ -5553,8 +5562,6 @@ void Server::handle_image_upscale(const httplib::Request& req, httplib::Response
                 info = model_manager_->get_model_info(upscale_model_name);
             }
 
-            upscale_model_path = info.resolved_path("main");
-            recipe = info.recipe;
         } catch (const std::exception& e) {
             res.status = 404;
             nlohmann::json error = {{"error", {
@@ -5567,24 +5574,24 @@ void Server::handle_image_upscale(const httplib::Request& req, httplib::Response
 
         std::string b64_image = request_json["image"].get<std::string>();
 
-        // Upscaling is model-free: no model is loaded through the router, so we
-        // dispatch by recipe to each backend's shared upscale API, which shells
-        // out to its own CLI binary directly (backend selection, binary path,
-        // and runtime environment all live in the backend).
-        std::string upscaled;
-        if (recipe == "thenoise") {
-            upscaled = lemon::backends::TheNoiseServer::upscale_via_cli(b64_image, upscale_model_path);
-        } else if (recipe == "sd-cpp") {
-            upscaled = lemon::backends::SDServer::upscale_via_cli(b64_image, upscale_model_path);
-        } else {
+        backends::BackendContext context;
+        context.log_level = config_->log_level();
+        context.model_manager = model_manager_.get();
+        context.backend_manager = backend_manager_.get();
+        context.cloud_registry = cloud_registry_.get();
+        context.model_info = &info;
+        auto server = backends::create_server(info.recipe, context);
+        if (!server || !supports_capability<IUpscaleServer>(server.get())) {
             res.status = 400;
             nlohmann::json error = {{"error", {
-                {"message", "Upscale is not supported by recipe: " + recipe},
+                {"message", "Upscale is not supported by recipe: " + info.recipe},
                 {"type", "invalid_request_error"}
             }}};
             res.set_content(error.dump(), "application/json");
             return;
         }
+        auto* upscale_server = dynamic_cast<IUpscaleServer*>(server.get());
+        std::string upscaled = upscale_server->upscale_via_cli(b64_image, info.resolved_path("main"));
 
         if (upscaled.empty()) {
             res.status = 500;
```

**File**: `test/cpp/test_backend_mode_contract.cpp` (modified, +10/-1)
```diff
@@ -46,7 +46,8 @@ const std::vector<std::pair<uint32_t, std::string>> kModeInterfaces = {
 // Capabilities that name no deployment mode, so kModeInterfaces omits them by
 // design rather than by oversight. Streaming transcription is a transport
 // detail of the transcription mode, not a mode of its own.
-constexpr uint32_t kNonModeCapabilities = lemon::CAP_STREAMING_TRANSCRIPTION;
+constexpr uint32_t kNonModeCapabilities = lemon::CAP_STREAMING_TRANSCRIPTION |
+                                          lemon::CAP_UPSCALE;
 
 // Serving one of these means a single fixed modality, which rules out chat.
 // Transcription is absent because a backend can serve it alongside chat. Defined
@@ -200,6 +201,14 @@ int main() {
                     join(desc.default_capabilities).c_str());
     }
 
+    const std::set<std::string> upscale_recipes = {"sd-cpp", "thenoise"};
+    for (const auto& entry : entries) {
+        const bool implements_upscale = (entry.capabilities & lemon::CAP_UPSCALE) != 0;
+        const bool expects_upscale = upscale_recipes.count(entry.descriptor->recipe) != 0;
+        check(entry.descriptor->recipe + ": upscale capability matches its backend command",
+              implements_upscale == expects_upscale);
+    }
+
     check_server_model_registry();
 
     // Ingest: a label set either describes a model this backend can deploy, or
```

---

### Incident Patch 9: `5797c0c3` (2026-09-16)
**Commit Message**: fix(server): size streaming models against APU GTT pool, not VRAM carve-out (#3377) (#3502)

* fix(server): size streaming models against APU GTT pool, not VRAM carve-out (#3377)

The model-size filter chose the memory-accounting behavior per device-type
container key, and dev_type == "amd_igpu" never matched: system_info
reports integrated GPUs under "amd_gpu" with an "integrated": true flag
and the host-visible GTT pool in virtual_mem_gb. Every device therefore
fell back to Hardware (vram_gb only), so on APUs the fixed VRAM carve-out
(~1-4 GB) was used as the ceiling and streaming models that fit in GTT
(up to ~120 GB on Strix Halo) were falsely rejected.

Choose the behavior per device, keyed on the device's own integrated flag.
dGPU / NVIDIA behavior (Hardware) is unchanged; enable_dgpu_gtt (Unified)
is unchanged.

* fix(server): default APU pool sizing to integrated when flag is absent

Address review on #3502: AMD APUs are reported under "amd_gpu" with
"integrated": true, so treat a device as integrated when the flag is
missing. Also pare down the explanatory comment per review.

* fix(server): ignore non-device system info entries

---------

Co-authored-by: bong-water-water

**File**: `src/cpp/server/model_manager.cpp` (modified, +12/-7)
```diff
@@ -3793,14 +3793,19 @@ std::map<std::string, ModelInfo> ModelManager::filter_models_by_backend(
         // Because we have mixed types this just makes every device_type an array.
         nlohmann::json dev_list = devices.is_array() ? devices : nlohmann::json{devices};
 
-        // Expand this later to accommodate mixed pools
-        MemoryAllocBehavior dev_mem_alloc_behavior = MemoryAllocBehavior::Hardware;
-        if (dev_type == "amd_igpu")
-            dev_mem_alloc_behavior = MemoryAllocBehavior::Largest;
-        if (enable_dgpu_gtt)
-            dev_mem_alloc_behavior = MemoryAllocBehavior::Unified;
-
         for (const auto& dev : dev_list) {
+            if (!dev.is_object())
+                continue;
+
+            // Behavior is chosen per device, not per device-type: AMD APUs are
+            // reported under "amd_gpu" with "integrated": true and their GTT
+            // pool in virtual_mem_gb -- an "amd_igpu" container key is never
+            // emitted, so default to integrated when the flag is absent.
+            MemoryAllocBehavior dev_mem_alloc_behavior = MemoryAllocBehavior::Hardware;
+            if (dev_type == "amd_gpu" && dev.value("integrated", true))
+                dev_mem_alloc_behavior = MemoryAllocBehavior::Largest;
+            if (enable_dgpu_gtt)
+                dev_mem_alloc_behavior = MemoryAllocBehavior::Unified;
             curr_mem_pool_gb = get_max_memory_of_device(dev, dev_mem_alloc_behavior);
             largest_mem_pool_gb = largest_mem_pool_gb < curr_mem_pool_gb ? curr_mem_pool_gb : largest_mem_pool_gb;
         }
```

---

### Incident Patch 10: `8b5a23b5` (2026-09-14)
**Commit Message**: fix(server): stop erasing llama.cpp slots on soft-idle downsize #2961 (#3565)

* removing the llamacpp downsize override to retain the saved cache

* PR feedback: Removing the test script

**File**: `docs/dev/backends-reference.md` (modified, +4/-0)
```diff
@@ -231,6 +231,10 @@ Voice design is opt-in through the `voice_design_description` extension and is n
 
 `MOSS-SoundEffect` uses the same recipe but is an audio-generation model: `audio_generations()` forwards to the backend's `/sfx` endpoint, accepting `duration`/`cfg` as aliases for `seconds`/`cfg_scale`.
 
+### llama.cpp (`llamacpp`)
+
+Lemonade launches `llama-server` with `--parallel 1` and leaves the upstream `--cache-ram` host prompt cache at its default. `LlamaCppServer` does not override `downsize()`: slot `erase` frees no device memory (the KV buffer is allocated once at model load) and discards the slot's KV state without going through the host-cache save path, so soft idle leaves the slot resident and a resumed conversation reuses its cached prefix.
+
 ### Model downloads
 
 A checkpoint file can be reached twice during a registry download: once because the backend's `select_checkpoint_files` claimed it alongside the main weight, and again because it is also declared as its own checkpoint role (the OpenMOSS `.extras.gguf` sidecars are both). The same bytes either way, so `download_from_registry` collapses duplicates before counting, or the progress total overshoots.
```

**File**: `docs/guide/configuration/multi-model.md` (modified, +1/-1)
```diff
@@ -95,7 +95,7 @@ A background monitor samples global VRAM usage (NVIDIA via `nvidia-smi`, AMD via
 
 **Tiered degradation.** Idle models degrade in two stages rather than a binary loaded/unloaded:
 
-1. **Soft idle (downsize):** after `downsize_idle_timeout` seconds idle, the KV cache/context is cleared to free dynamic memory while base weights stay resident. The next request transparently restores it.
+1. **Soft idle (downsize):** after `downsize_idle_timeout` seconds idle, the backend is asked to release dynamic memory while base weights stay resident. What this frees is backend-specific; for llama.cpp it is a no-op that leaves the prompt cache intact. The next request transparently restores the model to `ready`.
 2. **Hard idle / pressure (evict):** after `evict_idle_timeout` seconds idle, or under VRAM pressure, the model is fully unloaded (VRAM released; the weights file stays in the OS page cache for a fast reload).
 
 **Load-time-weighted scoring.** Under pressure, the engine evicts by:
```

**File**: `src/cpp/include/lemon/backends/llamacpp/llamacpp_server.h` (modified, +0/-3)
```diff
@@ -27,9 +27,6 @@ class LlamaCppServer : public WrappedServer, public IEmbeddingsServer, public IR
 
     void unload() override;
 
-    // Downsize the model on soft idle
-    bool downsize() override;
-
     // ICompletionServer implementation
     json chat_completion(const json& request) override;
     json completion(const json& request) override;
```

**File**: `src/cpp/server/backends/llamacpp/llamacpp_server.cpp` (modified, +0/-21)
```diff
@@ -598,27 +598,6 @@ void LlamaCppServer::unload() {
     }
 }
 
-bool LlamaCppServer::downsize() {
-    LOG(INFO, "LlamaCpp") << "Downsizing model by erasing KV cache..." << std::endl;
-    try {
-        json slots = get_slots();
-        if (slots.is_array()) {
-            for (const auto& slot : slots) {
-                if (slot.contains("id") && slot["id"].is_number()) {
-                    int id = slot["id"].get<int>();
-                    slots_action(id, "erase", json::object());
-                }
-            }
-        } else if (slots.contains("id")) {
-            slots_action(slots["id"].get<int>(), "erase", json::object());
-        }
-        return true;
-    } catch (const std::exception& e) {
-        LOG(ERROR, "LlamaCpp") << "Failed to downsize model: " << e.what() << std::endl;
-        return false;
-    }
-}
-
 json LlamaCppServer::normalize_response_model(json response, const json& request) const {
     if (response.is_object() && response.contains("model")) {
         response["model"] = request.value("model", get_model_name());
```

**File**: `test/server_eviction.py` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@
 VRAM_PRESSURE_PCT = 0.95
 VRAM_THRESHOLD_PCT = 0.90
 TEST_CTX_SIZE = 256
+CACHE_TEST_CTX_SIZE = 1024
 MODEL_AGE_GAP_SECONDS = 0.01
 RACE_STRESS_SECONDS = 4
 RACE_CHURN_PAUSE_SECONDS = 0.01
```

#### Recent Merged Pull Requests:
- **PR #3720** (2026-09-30): test: remove flaky test_000b_retired_endpoints_removed (@jeremyfowers)
- **PR #3703** (2026-09-29): docs: point GUI3 beta build instructions to GUI3_squashed (@kpoineal)
- **PR #3696** (closed): docs: add a spec writing guide under docs/dev/specs and link it from the RFC process (@jeremyfowers)
- **PR #3695** (2026-09-29): bump Kokoro (@bitgamma)
- **PR #3692** (2026-09-28): Update REPO_MANAGER_VERSION to v1.0.4 (@jeremyfowers)
- **PR #3690** (2026-09-30): Auto-install specified backends with `lemonade bench` (@bitgamma)
- **PR #3688** (closed): RFC: container backends spec (@jeremyfowers)
- **PR #3687** (2026-09-29): docs: add a spec writing guide under docs/dev/specs (@jeremyfowers)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
