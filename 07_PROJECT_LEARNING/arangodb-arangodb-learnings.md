# Forensic Learning Record (Deep Inspection): arangodb/arangodb

> **Canonical Artifact**: `07_PROJECT_LEARNING/arangodb-arangodb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arangodb/arangodb](https://github.com/arangodb/arangodb))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:05:31.453Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arangodb/arangodb`
- **Description**: 🥑 ArangoDB is a native multi-model database with flexible data models for documents, graphs, and key-values. Build high performance applications using a convenient SQL-like query language or JavaScript extensions.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 14278 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/beast/example/websocket/server/chat-multi/shared_state.cpp`
```
//
// Copyright (c) 2016-2019 Vinnie Falco (vinnie dot falco at gmail dot com)
//
// Distributed under the Boost Software License, Version 1.0. (See accompanying
// file LICENSE_1_0.txt or copy at http://www.boost.org/LICENSE_1_0.txt)
//
// Official repository: https://github.com/vinniefalco/CppCon2018
//

#include "shared_state.hpp"
#include "websocket_session.hpp"

shared_state::
shared_state(std::string doc_root)
    : doc_root_(std::move(doc_root))
{
}

void
shared_state::
join(websocket_session* session)
{
    std::lock_guard<std::mutex> lock(mutex_);
    sessions_.insert(session);
}

void
shared_state::
leave(websocket_session* session)
{
    std::lock_guard<std::mutex> lock(mutex_);
    sessions_.erase(session);
}

// Broadcast a message to all websocket client sessions
void
shared_state::
send(std::string message)
{
    // Put the message in a shared pointer so we can re-use it for each client
    auto const ss = boost::make_shared<std::string const>(std::move(message));

    // Make a local list of all the weak pointers representing
    // the sessions, so we can do the actual sending without
    // holding the mutex:
    std::vector<boost::weak_ptr<websocket_session>> v;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        v.reserve(sessions_.size());
        for(auto p : sessions_)
            v.emplace_back(p->weak_from_this());
    }

    // For each session in our local list, try to acquire a strong
    // pointer. If successful, then send the message on that session.
    for(auto const& wp : v)
        if(auto sp = wp.lock())
            sp->send(ss);
}

```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/bimap/example/tutorial_info_hook.cpp`
```
// Boost.Bimap
//
// Copyright (c) 2006-2007 Matias Capeletto
//
// Distributed under the Boost Software License, Version 1.0.
// (See accompanying file LICENSE_1_0.txt or copy at
// http://www.boost.org/LICENSE_1_0.txt)

//  VC++ 8.0 warns on usage of certain Standard Library and API functions that
//  can be cause buffer overruns or other possible security issues if misused.
//  See https://web.archive.org/web/20071014014301/http://msdn.microsoft.com/msdnmag/issues/05/05/SafeCandC/default.aspx
//  But the wording of the warning is misleading and unsettling, there are no
//  portable alternative functions, and VC++ 8.0's own libraries use the
//  functions in question. So turn off the warnings.
#define _CRT_SECURE_NO_DEPRECATE
#define _SCL_SECURE_NO_DEPRECATE

// Boost.Bimap Example
//-----------------------------------------------------------------------------

#include <boost/config.hpp>

#include <string>
#include <iostream>

#include <boost/bimap/bimap.hpp>
#include <boost/bimap/multiset_of.hpp>

using namespace boost::bimaps;


void tutorial_about_info_hook()
{
    //[ code_tutorial_info_hook_first

    typedef bimap<

        multiset_of< std::string >, // author
             set_of< std::string >, // title

          with_info< std::string >  // abstract

    > bm_type;
    typedef bm_type::value_type book;

    bm_type bm;

    bm.insert(

        book( "Bjarne Stroustrup"   , "The C++ Programming Language",

              "For C++ old-timers, the first edition of this book is"
              "the one that started it all—the font of our knowledge." )
    );


    // Print the author of the bible
    std::cout << bm.right.at("The C++ Programming Language");

    // Print the abstract of this book
    bm_type::left_iterator i = bm.left.find("Bjarne Stroustrup");
    std::cout << i->info;
    //]

    // Contrary to the two key types, the information will be mutable
    // using iterators.

    //[ code_tutorial_info_hook_mutable

    i->info += "More details about this book";
    //]

    // A new function is included in unique map views: info_at(key), that
    // mimics the standard at(key) function but returned the associated
    // information instead of the data.

    //[ code_tutorial_info_hook_info_at

    // Print the new abstract
    std::cout << bm.right.info_at("The C++ Programming Language");
    //]
}

struct author {};
struct title {};
struct abstract {};

void tutorial_about_tagged_info_hook()
{
    //[ code_tutorial_info_hook_tagged_info

    typedef bimap<

        multiset_of< tagged< std::string, author   > >,
             set_of< tagged< std::string, title    > >,

          with_info< tagged< std::string, abstract > >

    > bm_type;
    typedef bm_type::value_type book;

    bm_type bm;

    bm.insert(

        book( "Bjarne Stroustrup"   , "The C++ Programming Language",

              "For C++ old-timers, the first edition of this book is"
              "the one that started it all—the font of our knowledge." )
    );

    // Print the author of the bible
    std::cout << bm.by<title>().at("The C++ Programming Language");

    // Print the abstract of this book
    bm_type::map_by<author>::iterator i = bm.by<author>().find("Bjarne Stroustrup");
    std::cout << i->get<abstract>();

    // Contrary to the two key types, the information will be mutable
    // using iterators.

    i->get<abstract>() += "More details about this book";

    // Print the new abstract
    std::cout << bm.by<title>().info_at("The C++ Programming Language");
    //]
}


void bimap_without_an_info_hook()
{
    //[ code_tutorial_info_hook_nothing

    typedef bimap<

        multiset_of< std::string >, // author
             set_of< std::string >  // title

    > bm_type;
    typedef bm_type::value_type book;

    bm_type bm;

    bm.insert( book( "Bjarne Stroustrup"   , "The C++ Programming Language" ) );
    bm.insert( book( "Scott Meyers"        , "Effective C++"                ) );
    bm.insert( book( "Andrei Alexandrescu" , "Modern C++ Design"            ) );

    // Print the author of Modern C++
    std::cout << bm.right.at( "Modern C++ Design" );
    //]
}


int main()
{
    tutorial_about_info_hook();
    tutorial_about_tagged_info_hook();
    bimap_without_an_info_hook();

    return 0;
}



```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/compute/example/threefry_engine.cpp`
```
//---------------------------------------------------------------------------//
// Copyright (c) 2013 Muhammad Junaid Muzammil <mjunaidmuzammil@gmail.com>
//
// Distributed under the Boost Software License, Version 1.0
// See accompanying file LICENSE_1_0.txt or copy at
// http://www.boost.org/LICENSE_1_0.txt
//
// See http://kylelutz.github.com/compute for more information.
//---------------------------------------------------------------------------//


#include <boost/compute/random/threefry_engine.hpp>
#include <boost/compute/container/vector.hpp>
#include <boost/compute/command_queue.hpp>
#include <boost/compute/context.hpp>
#include <boost/compute/device.hpp>
#include <boost/compute/system.hpp>
#include <iostream>

int main() 
{
    using boost::compute::uint_;
    boost::compute::device device = boost::compute::system::default_device();
    boost::compute::context context(device);
    boost::compute::command_queue queue(context, device);
    boost::compute::threefry_engine<> rng(queue);
    boost::compute::vector<uint_> vector_ctr(20, context);
    
    uint32_t ctr[20];
    for(int i = 0; i < 10; i++) {
        ctr[i*2] = i;
        ctr[i*2+1] = 0;
    }
    boost::compute::copy(ctr, ctr+20, vector_ctr.begin(), queue);
    rng.generate(vector_ctr.begin(), vector_ctr.end(), queue);
    boost::compute::copy(vector_ctr.begin(), vector_ctr.end(), ctr, queue);

    for(int i = 0; i < 10; i++) {
        std::cout << std::hex << ctr[i*2] << " " << ctr[i*2+1] << std::endl;
    }
    return 0;
}


```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/context/example/callcc/endless_loop.cpp`
```

//          Copyright Oliver Kowalke 2016.
// Distributed under the Boost Software License, Version 1.0.
//    (See accompanying file LICENSE_1_0.txt or copy at
//          http://www.boost.org/LICENSE_1_0.txt)

#include <cstdlib>
#include <iostream>

#include <boost/context/continuation.hpp>

namespace ctx = boost::context;

ctx::continuation foo( ctx::continuation && c) {
    do {
        std::cout << "foo\n";
    } while ( ( c = c.resume() ) );
    return std::move( c);
}

int main() {
    ctx::continuation c = ctx::callcc( foo);
    do {
        std::cout << "bar\n";
    } while ( ( c = c.resume() ) );
    std::cout << "main: done" << std::endl;
    return EXIT_SUCCESS;
}

```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/context/example/fiber/endless_loop.cpp`
```

//          Copyright Oliver Kowalke 2016.
// Distributed under the Boost Software License, Version 1.0.
//    (See accompanying file LICENSE_1_0.txt or copy at
//          http://www.boost.org/LICENSE_1_0.txt)

#include <cstdlib>
#include <iostream>

#include <boost/context/fiber.hpp>

namespace ctx = boost::context;

ctx::fiber bar( ctx::fiber && f) {
    do {
        std::cout << "bar\n";
        f = std::move( f).resume();
    } while ( f);
    return std::move( f);
}

int main() {
    ctx::fiber f{ bar };
    do {
        std::cout << "foo\n";
        f = std::move( f).resume();
    } while ( f);
    std::cout << "main: done" << std::endl;
    return EXIT_SUCCESS;
}

```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/contract/example/features/loop.cpp`
```

// Copyright (C) 2008-2018 Lorenzo Caminiti
// Distributed under the Boost Software License, Version 1.0 (see accompanying
// file LICENSE_1_0.txt or a copy at http://www.boost.org/LICENSE_1_0.txt).
// See: http://www.boost.org/doc/libs/release/libs/contract/doc/html/index.html

#include <boost/contract.hpp>
#include <vector>
#include <algorithm>
#include <limits>

int main() {
    std::vector<int> v;
    v.push_back(1);
    v.push_back(2);
    v.push_back(3);

    //[loop
    int total = 0;
    // Contract for a for-loop (same for while- and all other loops).
    for(std::vector<int>::const_iterator i = v.begin(); i != v.end(); ++i) {
        boost::contract::old_ptr<int> old_total = BOOST_CONTRACT_OLDOF(total);
        boost::contract::check c = boost::contract::function()
            .precondition([&] {
                BOOST_CONTRACT_ASSERT(
                        total < std::numeric_limits<int>::max() - *i);
            })
            .postcondition([&] {
                BOOST_CONTRACT_ASSERT(total == *old_total + *i);
            })
        ;

        total += *i; // For-loop body.
    }
    //]

    assert(total == 6);
    return 0;
}


```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/contract/example/mitchell02/simple_queue.cpp`
```

// Copyright (C) 2008-2018 Lorenzo Caminiti
// Distributed under the Boost Software License, Version 1.0 (see accompanying
// file LICENSE_1_0.txt or a copy at http://www.boost.org/LICENSE_1_0.txt).
// See: http://www.boost.org/doc/libs/release/libs/contract/doc/html/index.html

//[mitchell02_simple_queue
#include <boost/contract.hpp>
#include <boost/optional.hpp>
#include <vector>
#include <cassert>

template<typename T>
class simple_queue
    #define BASES private boost::contract::constructor_precondition< \
            simple_queue<T> >
    : BASES
{
    friend class boost::contract::access;

    typedef BOOST_CONTRACT_BASE_TYPES(BASES) base_types;
    #undef BASES

    void invariant() const {
        BOOST_CONTRACT_ASSERT(count() >= 0); // Non-negative count.
    }

public:
    /* Creation */

    // Create empty queue.
    explicit simple_queue(int a_capacity) :
        boost::contract::constructor_precondition<simple_queue>([&] {
            BOOST_CONTRACT_ASSERT(a_capacity > 0); // Positive capacity.
        })
    {
        boost::contract::check c = boost::contract::constructor(this)
            .postcondition([&] {
                // Capacity set.
                BOOST_CONTRACT_ASSERT(capacity() == a_capacity);
                BOOST_CONTRACT_ASSERT(is_empty()); // Empty.
            })
        ;

        items_.reserve(a_capacity);
    }

    // Destroy queue.
    virtual ~simple_queue() {
        // Check invariants.
        boost::contract::check c = boost::contract::destructor(this);
    }

    /* Basic Queries */

    // Items in queue (in their order).
    // (Somewhat exposes implementation but allows to check more contracts.)
    std::vector<T> const& items() const {
        // Check invariants.
        boost::contract::check c = boost::contract::public_function(this);
        return items_;
    }

    // Max number of items queue can hold.
    int capacity() const {
        // Check invariants.
        boost::contract::check c = boost::contract::public_function(this);
        return items_.capacity();
    }

    /* Derived Queries */

    // Number of items.
    int count() const {
        int result;
        boost::contract::check c = boost::contract::public_function(this)
            .postcondition([&] {
                // Return items count.
                BOOST_CONTRACT_ASSERT(result == int(items().size()));
            })
        ;

        return result = items_.size();
    }

    // Item at head.
    T const& head() const {
        boost::optional<T const&> result;
        boost::contract::check c = boost::contract::public_function(this)
            .precondition([&] {
                BOOST_CONTRACT_ASSERT(!is_empty()); // Not empty.
            })
            .postcondition([&] {
                // Return item on top.
                BOOST_CONTRACT_ASSERT(*result == items().at(0));
            })
        ;

        return *(result = items_.at(0));
    }

    // If queue contains no item.
    bool is_empty() const {
        bool result;
        boost::contract::check c = boost::contract::public_function(this)
            .postcondition([&] {
                // Consistent with count.
                BOOST_CONTRACT_ASSERT(result == (count() == 0));
            })
        ;

        return result = (items_.size() == 0);
    }

    // If queue has no room for another item.
    bool is_full() const {
        bool result;
        boost::contract::check c = boost::contract::public_function(this)
            .postcondition([&] {
                BOOST_CONTRACT_ASSERT( // Consistent with size and capacity.
                        result == (capacity() == int(items().size())));
            })
        ;

        return result = (items_.size() == items_.capacity());
    }

    /* Commands */

    // Remove head itme and shift all other items.
    void remove() {
        // Expensive all_equal postcond. and old_items copy might be skipped.
        boost::contract::old_ptr<std::vector<T> > old_items;
            #ifdef BOOST_CONTRACT_AUDIITS
                = BOOST_CONTRACT_OLDOF(items())
            #endif // Else, leave old pointer null...
        ;
        boost::contract::old_ptr<int> old_count = BOOST_CONTRACT_OLDOF(count());
        boost::contract::check c = boost::contract::public_function(this)
            .precondition([&] {
                BOOST_CONTRACT_ASSERT(!is_empty()); // Not empty.
            })
            .postcondition([&] {
                BOOST_CONTRACT_ASSERT(count() == *old_count - 1); // Count dec.
                // ...following skipped #ifndef AUDITS.
                if(old_items) all_equal(items(), *old_items, /* shifted = */ 1);
            })
        ;
        
        items_.erase(items_.begin());
    }

    // Add item to tail.
    void put(T const& item) {
        // Expensive all_equal postcond. and old_items copy might be skipped.
        boost::contract::old_ptr<std::vector<T> > old_items;
            #ifdef BOOST_CONTRACT_AUDITS
                = BOOST_CONTRACT_OLDOF(items())
            #endif // Else, leave old pointer null...
        ;
        boost::contract::old_ptr<int> old_count = BOOST_CONTRACT_OLDOF(count());
        boost::contract::check c = boost::contract::public_function(this)
            .precondition([&] {
                BOOST_CONTRACT_ASSERT(count() < capacity()); // Room for add.
            })
            .postcondition([&] {
                BOOST_CONTRACT_ASSERT(count() == *old_count + 1); // Count inc.
                // Second to last item.
                BOOST_CONTRACT_ASSERT(items().at(count() - 1) == item);
                // ...following skipped #ifndef AUDITS.
                if(old_items) all_equal(items(), *old_items);
            })
        ;
        
        items_.push_back(item);
    }

private:
    // Contract helper.
    static bool all_equal(std::vector<T> const& left,
            std::vector<T> const& right, unsigned offset = 0) {
        boost::contract::check c = boost::contract::function()
            .precondition([&] {
                // Correct offset.
                BOOST_CONTRACT_ASSERT(right.size() == left.size() + offset);
            })
        ;

        for(unsigned i = offset; i < right.size(); ++i) {
            if(left.at(i - offset) != right.at(i)) return false;
        }
        return true;
    }

    std::vector<T> items_;
};

int main() {
    simple_queue<int> q(10);
    q.put(123);
    q.put(456);

    assert(q.capacity() == 10);
    assert(q.head() == 123);

    assert(!q.is_empty());
    assert(!q.is_full());

    std::vector<int> const& items = q.items();
    assert(items.at(0) == 123);
    assert(items.at(1) == 456);
    
    q.remove();
    assert(q.count() == 1);

    return 0;
}
//]


```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/geometry/doc/src/docutils/tools/doxygen_xml2qbk/doxygen_xml2qbk.cpp`
```
// doxml2qbk (developed in the context of Boost.Geometry documentation)
//
// Copyright (c) 2010-2013 Barend Gehrels, Amsterdam, the Netherlands.
// Copyright (c) 2012-2013 Adam Wulkiewicz, Lodz, Poland.
//
// This file was modified by Oracle on 2020.
// Modifications copyright (c) 2020, Oracle and/or its affiliates.
// Contributed and/or modified by Adam Wulkiewicz, on behalf of Oracle
//
// Use, modification and distribution is subject to the Boost Software License,
// Version 1.0. (See accompanying file LICENSE_1_0.txt or copy at
// http://www.boost.org/LICENSE_1_0.txt)
//
//
// Barend Gehrels, Aug 1, 2010
// In continuation of the QuickBook documentation of Boost.Geometry
//
// Converts XML files created by Doxygen to Quickbook
// Notes:
// - basically generic, but implemented with Boost.Geometry in mind
// - makes use of some specific XML elements, which can be created by Doxygen
//       using /xmlonly
//     currently this is the element <qbk.example> which will make a reference
//     to an example.
// - currently still in draft

#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <map>

#include <boost/foreach.hpp>
#include <boost/algorithm/string.hpp>
#include <boost/algorithm/string/split.hpp>


#include <boost/program_options.hpp>

#include <rapidxml.hpp>

#include <configuration.hpp>
#include <file_to_string.hpp>
#include <doxygen_elements.hpp>
#include <doxygen_xml_parser.hpp>
#include <parameter_predicates.hpp>
#include <quickbook_output.hpp>
#include <rapidxml_util.hpp>

static const std::string version = "1.1.1";

inline std::string program_description(bool decorated)
{
    std::string result;
    if (decorated)
    {
        result = "=== ";
    }
    result += "doxygen_xml2qbk ";
    result += version;
    if (decorated)
    {
        result += " ===";
    }
    return result;
}


int main(int argc, char** argv)
{
    std::string filename;
    try
    {
        configuration config;
        std::string copyright_filename;
        std::string output_style;

        // Read/get configuration
        {
            namespace po = boost::program_options;
            po::options_description description;

            std::string convenience_headers;

            description.add_options()
                ("help", "Help message")
                ("version", "Version description")
                ("xml", po::value<std::string>(&filename),
                            "Name of XML file written by Doxygen")
                ("start_include", po::value<std::string>(&config.start_include),
                            "Start include")
                ("convenience_header_path", po::value<std::string>(&config.convenience_header_path),
                            "Convenience header path")
                ("convenience_headers", po::value<std::string>(&convenience_headers),
                            "Convenience header(s) (comma-separated)")
                ("skip_namespace", po::value<std::string>(&config.skip_namespace),
                            "Namespace to skip (e.g. boost::mylib::)")
                ("copyright", po::value<std::string>(&copyright_filename),
                            "Name of QBK file including (commented) copyright and license")

                ("output_style", po::value<std::string>(&output_style),
                            "Docbook output style. Available values: 'alt'")
                ("output_member_variables", po::value<bool>(&config.output_member_variables),
                            "Output member variables inside the class")
                ("alt_max_synopsis_length", po::value<unsigned>(&config.alt_max_synopsis_length),
                            "Maximum length of function synopsis used without shortened QBK section name.")
            ;

            po::variables_map varmap;

            if (argc == 2 && ! boost::starts_with(argv[1], "--"))
            {
                // (especially for debugging) options might go into an INI file
                std::ifstream config_file (argv[1], std::ifstream::in);
                po::store(po::parse_config_file(config_file, description), varmap);
            }
            else
            {
                po::store(po::parse_command_line(argc, argv, description), varmap);
            }

            po::notify(varmap);

            if (varmap.count("version"))
            {
                std::cout << version << std::endl;
                return 0;
            }
            else if (varmap.count("help"))
            {
                std::cout
                    << program_description(true) << std::endl
                    << "Available options:" << std::endl
                    << description << std::endl;
                return 0;
            }
            else if (filename.empty())
            {
                std::cout
                    << program_description(true) << std::endl
                    << "Allowed options:" << std::endl
                    << description << std::endl;
                return 1;
            }

            // Split CSV with headerfile names into configuration
            if (! convenience_headers.empty())
            {
                boost::split(config.convenience_headers, convenience_headers, boost::is_any_of(","));
            }
        }

        // Set output style
        if ("alt" == output_style)
        {
            config.output_style = configuration::alt;
        }

        // Read files into strings
        std::string xml_string = file_to_string(filename);
        std::string license = copyright_filename.empty()
            ? ""
            : file_to_string(copyright_filename);

        // Parse the XML outputted by Doxygen
        xml_doc xml(xml_string.c_str());

        documentation doc;
        parse(xml.first_node(), config, doc);

        // Check for duplicate function names
        for (std::size_t i = 0; i < doc.functions.size(); i++)
        {
            function& f1 = doc.functions[i];
            for (std::size_t j = i + 1; j < doc.functions.size(); j++)
            {
                function& f2 = doc.functions[j];

                if (f1.name == f2.name)
                {
                    // It is not a unique function, so e.g. an overload,
                    // so a description must distinguish them.
                    // Difference is either the number of parameters, or a const / non-const version
                    // Use the "\qbk{distinguish,with strategy}" in the source code to distinguish
                    f1.unique = false;
                    f2.unique = false;
                }
            }
        }


        // Write copyright/license (keep inspect silent)
        if (! license.empty())
        {
            std::cout << license << std::endl;
        }

        // Write warning comment
        std::cout
            << "[/ Generated by " << program_description(false) << ", don't change, will be overwritten automatically]" << std::endl
            << "[/ Generated from " << filename << "]" << std::endl;

        if ( configuration::def == config.output_style )
        {
            // Write the rest: functions, defines, classes or structs
            BOOST_FOREACH(function const& f, doc.functions)
            {
                quickbook_output(f, config, std::cout);
            }
            BOOST_FOREACH(function const& f, doc.defines)
            {
                quickbook_output(f, config, std::cout);
            }
            BOOST_FOREACH(enumeration const& e, doc.enumerations)
            {
                quickbook_output(e, config, std::cout);
            }

            if (! doc.cos.name.empty())
            {
                std::sort(doc.cos.functions.begin(), doc.cos.functions.end(), sort_on_line<function>());
                quickbook_output(doc.cos, config, std::cout);
            }
        }
        else if ( configuration::alt == config.output_style )
        {
            if (! doc.cos.name.empty())
            {
                std::sort(doc.cos.functions.begin(), doc.cos.functions.end(), sort_on_line<function>());
                quickbook_output_alt(doc.cos, config, std::cout);
            }

            if (! doc.group_id.empty())
            {
                quickbook_output_alt(doc, config, std::cout);
            }
        }
    }
    catch(std::exception const& e)
    {
        std::cerr << "Exception in doxygen_xml2qbk: " << std::endl
            << "   Message: " << e.what() << std::endl
            << "   File: " << filename << std::endl
            << "   Type: " << typeid(e).name() << std::endl
            << std::endl;
        return 1;
    }
    catch(...)
    {
        std::cerr << "Unknown exception in doxygen_xml2qbk"
            << std::endl;
        return 1;
    }
    return 0;
}


```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/geometry/doc/src/docutils/tools/doxygen_xml2qbk/sample/make_qbk.py`
```
#! /usr/bin/env python
# -*- coding: utf-8 -*-
# ===========================================================================
#  Copyright (c) 2011-2012 Barend Gehrels, Amsterdam, the Netherlands.
# 
#  Use, modification and distribution is subject to the Boost Software License,
#  Version 1.0. (See accompanying file LICENSE_1_0.txt or copy at
#  http://www.boost.org/LICENSE_1_0.txt)9
# ============================================================================

import os, sys

cmd = "doxygen_xml2qbk"
cmd = cmd + " --xml xml/%s.xml"
cmd = cmd + " --start_include sample/"
cmd = cmd + " > generated\%s.qbk"


os.system("doxygen fruit.dox")
os.system(cmd % ("group__fruit", "grouped"))
os.system(cmd % ("classfruit_1_1apple", "apple"))
os.system(cmd % ("classfruit_1_1rose", "rose"))
os.system(cmd % ("structfruit_1_1fruit__value", "fruit_value"))
os.system(cmd % ("structfruit_1_1fruit__type", "fruit_type"))

os.system("bjam") 

```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/geometry/doc/src/docutils/tools/doxygen_xml2qbk/sample/src/examples/apple_example.cpp`
```
// Boost.Geometry (aka GGL, Generic Geometry Library)
// doxygen_xml2qbk Example

// Copyright (c) 2011-2012 Barend Gehrels, Amsterdam, the Netherlands.

// Use, modification and distribution is subject to the Boost Software License,
// Version 1.0. (See accompanying file LICENSE_1_0.txt or copy at
// http://www.boost.org/LICENSE_1_0.txt)

//[apple
//` Call eat for the apple

#include "fruit.hpp"

int main()
{
    fruit::apple<> a("my sample apple");
    eat(a);
    return 0;
}
//]


//[apple_output
/*`
Output:
[pre
my sample apple
]
*/
//]

```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/geometry/doc/src/docutils/tools/doxygen_xml2qbk/sample/src/fruit.cpp`
```
// Boost.Geometry (aka GGL, Generic Geometry Library)
// doxygen_xml2qbk Example

// Copyright (c) 2011-2012 Barend Gehrels, Amsterdam, the Netherlands.

// Use, modification and distribution is subject to the Boost Software License,
// Version 1.0. (See accompanying file LICENSE_1_0.txt or copy at
// http://www.boost.org/LICENSE_1_0.txt)


#include <iostream>
#include <string>

#include "fruit.hpp"


int main()
{
    fruit::apple<> a("my apple");
    eat(a);

    return 0;
}


```

### Core Architecture Module: `3rdParty/boost/1.78.0/libs/geometry/doc/src/docutils/tools/implementation_status/implementation_status.cpp`
```
// Boost.Geometry (aka GGL, Generic Geometry Library)
// Tool reporting Implementation Status in QBK format

// Copyright (c) 2011-2014 Barend Gehrels, Amsterdam, the Netherlands.
// Copyright (c) 2011-2014 Bruno Lalande, Paris, France.

// Use, modification and distribution is subject to the Boost Software License,
// Version 1.0. (See accompanying file LICENSE_1_0.txt or copy at
// http://www.boost.org/LICENSE_1_0.txt)

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include <stdlib.h>

#include <boost/timer.hpp>
#include <boost/algorithm/string/predicate.hpp>
#include <boost/algorithm/string/replace.hpp>
#include <boost/algorithm/string/trim.hpp>

static const int point = 0;
static const int segment = 1;
static const int box = 2;
static const int linestring = 3;
static const int ring = 4;
static const int polygon = 5;
static const int multi_point = 6;
static const int multi_linestring = 7;
static const int multi_polygon = 8;
static const int variant = 9;
static const int geometry_count = 10;

struct compile_bjam
{
    static inline bool apply(std::string const& id)
    {
        std::ostringstream command;
        // For debugging:
        command << "b2 -a tmp > tmp/t_" << id << ".out";
        //command << "b2 -a tmp > tmp/t.out";
        int failed = system(command.str().c_str());

        {
            // For debugging: save t.cpp
            std::ostringstream c2;
            c2 << "cp tmp/t.cpp tmp/t_" << id << ".cpp";
            system(c2.str().c_str());
        }
        return failed == 0;
    }
};


struct compile_clang
{
    bool first;

    compile_clang()
        : first(true)
    {}

    inline bool apply(std::string const& id)
    {
        if (first)
        {
           // Generate the pre-compiled header
           system("clang -x c++-header -I . -I ../../../../../../.. implementation_status.hpp");
           first = false;
        }

        std::ostringstream command;
        // We compile only, not even link
        command << "clang -include implementation_status.hpp -I . -I ../../../../../../.. -c tmp/t.cpp > tmp/t_" << id << ".out 2>&1";
        int failed = system(command.str().c_str());

        {
            // For debugging: save t.cpp
            std::ostringstream c2;
            c2 << "cp tmp/t.cpp tmp/t_" << id << ".cpp";
            system(c2.str().c_str());
        }
        return failed == 0;
    }
};

struct compile_msvc
{
    bool first;
    int count;

    compile_msvc()
        : first(true)
        , count(0)
    {}

    inline bool apply(std::string const& id)
    {
        std::ostringstream command;
        command << "cl /nologo -I. -I/_svn/boost/trunk /EHsc /Y";
        if (first)
        {
            std::cout << " (creating PCH)";
            command << "c";
            first = false;
        }
        else
        {
            command <<  "u";
        }

        command << "implementation_status.hpp tmp/t.cpp > tmp/t" //.out";
            // For debugging:
            << id << ".out";

        int failed = system(command.str().c_str());
        return failed == 0;
    }
};

struct algorithm
{
    std::string name;
    int arity;

    explicit algorithm(std::string const& n, int a = 1)
        : name(n)
        , arity(a)
    {}
};


inline std::string bool_string(bool v)
{
    return v ? "true" : "false";
}

inline std::string typedef_string(int type, bool clockwise, bool open)
{
    std::ostringstream out;
    switch(type)
    {
        case point : return "P";
        case linestring : return "bg::model::linestring<P>";
        case box : return "bg::model::box<P>";
        case segment : return "bg::model::segment<P>";
        case ring :
            out << "bg::model::ring<P, "
                << bool_string(clockwise) << ", " << bool_string(open) << ">";
            break;
        case variant :
        case polygon :
            out << "bg::model::polygon<P, "
                << bool_string(clockwise) << ", " << bool_string(open) << ">";
            break;
        case multi_point : return "bg::model::multi_point<P>";
        case multi_linestring :
            out << "bg::model::multi_linestring<bg::model::linestring<P> >";
            break;
        case multi_polygon :
            out << "bg::model::multi_polygon<bg::model::polygon<P, "
                << bool_string(clockwise) << ", " << bool_string(open) << "> >";
            break;
    }
    return out.str();
}

inline std::string wkt_string(int type)
{
    switch(type)
    {
        case point : return "POINT(1 1)";
        case linestring : return "LINESTRING(1 1,2 2)";
        case segment : return "LINESTRING(1 1,2 2)";
        case box : return "POLYGON((1 1,2 2))";
        case polygon :
        case variant :
        case ring :
            return "POLYGON((0 0,0 1,1 1,0 0))";
        case multi_point : return "MULTIPOINT((1 1),(2 2))";
        case multi_linestring : return "MULTILINESTRING((1 1,2 2))";
        case multi_polygon : return "MULTIPOLYGON(((0 0,0 1,1 1,0 0)))";
    }
    return "";
}

inline std::string geometry_string(int type)
{
    switch(type)
    {
        case point : return "Point";
        case linestring : return "Linestring";
        case box : return "Box";
        case polygon : return "Polygon";
        case ring : return "Ring";
        case segment : return "Segment";
        case multi_point : return "MultiPoint";
        case multi_linestring : return "MultiLinestring";
        case multi_polygon : return "MultiPolygon";
        case variant : return "Variant";
    }
    return "";
}

template <typename CompilePolicy>
int report_library(CompilePolicy& compile_policy,
                   int type, algorithm const& algo, bool clockwise,
                   bool open, int dimensions, std::string const& cs,
                   int type2 = -1)
{
    std::string lit;
    {
        std::ostringstream out;
        out << geometry_string(type);
        if (type2 != -1)
        {
            out << "_" << geometry_string(type2);
        }
        out
            << "_" << algo.name
            << "_" << bool_string(clockwise)
            << "_" << bool_string(open)
            << "_" << boost::replace_all_copy
                        (
                            boost::replace_all_copy
                                (
                                    boost::replace_all_copy(cs, "bg::", "")
                                , "<", "_"
                                )
                            , ">", "_"
                        );
        lit = out.str();
    }

    std::cout << lit;

    {
        std::ofstream out("tmp/t.cpp");

        std::string name = "geometry";

        if (type == variant)
        {
            name = "source";
        }

        out << "#include <implementation_status.hpp>" << std::endl;

        if (type == variant)
        {
            out << "#include <boost/variant/variant.hpp>" << std::endl;
        }

        out
            << "template <typename P>" << std::endl
            << "inline void test()" << std::endl
            << "{" << std::endl
            << "  namespace bg = boost::geometry;" << std::endl
            << "  " << typedef_string(type, clockwise, open) << " " << name << ";" << std::endl
            << "  bg::read_wkt(\"" << wkt_string(type) << "\", " << name << ");" << std::endl;

        if (type == variant)
        {
            out
                << "  typedef " << typedef_string(polygon, clockwise, open) << " type1;" << std::endl
                << "  typedef " << typedef_string(box, clockwise, open) << " type2;" << std::endl
                << "  boost::variant<type1, type2> geometry;" << std::endl
                << "  geometry = source;"
                << std::endl;
        }

        if (algo.arity > 1)
        {
            out
                << "  " << typedef_string(type2, clockwise, open) << " geometry2;" << std::endl
                << "  bg::read_wkt(\"" << wkt_string(type2) << "\", geometry2);" << std::endl;
        }

        if (algo.name == std::string("centroid"))
        {
            out << "  P point;";
            out << "  bg::" << algo.name << "(geometry, point);" << std::endl;
        }
        else if (algo.name == std::string("envelope"))
        {
            out << "  bg::model::box<P> box;";
            out << "  bg::" << algo.name << "(geometry, box);" << std::endl;
        }
        else
        {
            switch(algo.arity)
            {
                case 1 :
                    out << "  bg::" << algo.name << "(geometry);" << std::endl;
                    break;
                case 2 :
                    // For cases as point-in-polygon, take first geometry 2 (point), then geometry (polygon) such that
                    // it is listed as column:point in row:polygon
                    out << "  bg::" << algo.name << "(geometry2, geometry);" << std::endl;
                    break;
            }
        }

        out
            << "}" << std::endl
            << std::endl
            ;

        out
            << "int main()" << std::endl
            << "{" << std::endl
            << "  namespace bg = boost::geometry;" << std::endl
            << "  test<bg::model::point< double, " << dimensions << ", bg::cs::" << cs << " > >();" << std::endl
            << "  return 0;" << std::endl
            << "}" << std::endl
            << std::endl
            ;
    }

    bool result = compile_policy.apply(lit);
    if (! result)
    {
        std::cout << " ERROR";
    }
    std::cout << std::endl;
    return result;
}


template <typename CompilePolicy>
std::vector<int> report(CompilePolicy& compile_policy,
                        int type, algorithm const& algo, bool clockwise,
                        bool open, int dimensions, std::string const& cs)
{
    std::vector<int> result;

    switch(algo.arity)
    {
        case 1 :
            result.push_back(report_library(compile_policy, type, algo, clockwise, open, dimension
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23422** (2026-10-05): **[3.11.14] Upgrade OpenSSL to 3.5.9 and OpenLDAP to 2.6.15**
  *Symptoms*: ### Scope & Purpose  Upgrade OpenSSL to 3.5.9 and OpenLDAP to 2.6.15.  - [x] :pizza: New feature  ### Checklist  - [x] Tests   - [x] **Regression tests**     - [x] **integration tests** - [x] :book: CHANGELOG entry made

- **Issue #23421** (2026-10-05): **Upgrade OpenSSL to 3.5.9**
  *Symptoms*: Upgrade OpenSSL to 3.5.9 in 4.0.

- **Issue #23420** (2026-10-05): **Upgrade OpenSSL to 3.5.9**
  *Symptoms*: Upgrade OpenSSL to 3.5.9

- **Issue #23415** (2026-10-05): **[COR-1048] Keep full documents visible across comma-separated MATCH patterns**
  *Symptoms*: - Share a single MATCH variable scope across all comma-separated patterns.  - A later pattern such as 'WHERE w.age == u.age' reads the full document for 'u', rather than the variable value overwritten by an earlier 'RETURN' projection.  - After the entire MATCH is evaluated, 'u' still contains the projected document.  - Locked unit test. 

- **Issue #23413** (2026-10-03): **as**
  *Symptoms*: 

- **Issue #23408** (2026-10-02): **[4.0] Update node modules: brace-expansion to 5.0.12, fast-uri to 3.1.8**
  *Symptoms*: ### Scope & Purpose  Resolves CVE-2026-102276, CVE-2026-102277, CVE-2026-102278 (brace-expansion) and CVE-2026-86472 (fast-uri).  ### Checklist  - [x] Tests   - [x] **Regression tests**   - [x] **integration tests** - [x] :book: CHANGELOG entry made

- **Issue #23407** (2026-10-02): **Update node modules: brace-expansion to 5.0.12, fast-uri to 3.1.8**
  *Symptoms*: ### Scope & Purpose  Resolves CVE-2026-102276, CVE-2026-102277, CVE-2026-102278 (brace-expansion) and CVE-2026-86472 (fast-uri).  ### Checklist  - [x] Tests   - [x] **Regression tests**   - [x] **integration tests** - [x] :book: CHANGELOG entry made

- **Issue #23406** (2026-10-05): **[3.11.14] Update node modules: brace-expansion to 5.0.12, fast-uri to 3.1.8**
  *Symptoms*: ### Scope & Purpose  Resolves CVE-2026-102276, CVE-2026-102277, CVE-2026-102278 (brace-expansion) and CVE-2026-86472 (fast-uri).  ### Checklist  - [x] Tests   - [x] **Regression tests**   - [x] **integration tests** - [x] :book: CHANGELOG entry made

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

### Incident Patch 1: `6ee02e7d` (2026-10-05)
**Commit Message**: Merge pull request #23405 from arangodb/bug-fix/arangosh-login-error-handling

Bug fix/arangosh login error handling

**File**: `client-tools/Shell/ShellConsoleFeature.h` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ class ShellConsoleFeature final
   void start() override final;
   void unprepare() override final;
 
+  bool shouldConnect() const { return _options.connect; }
   bool quiet() const { return _options.quiet; }
   void setQuiet(bool value) { _options.quiet = value; }
   bool colors() const { return _options.colors; }
```

**File**: `client-tools/Shell/ShellConsoleFeatureOptions.h` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ namespace arangodb {
 
 struct ShellConsoleFeatureOptions {
   bool quiet = false;
+  bool connect = true;
   bool colors = true;
   bool useHistory = true;
   bool autoComplete = true;
```

**File**: `client-tools/Shell/ShellConsoleOptionsProvider.cpp` (modified, +2/-0)
```diff
@@ -34,6 +34,8 @@ void ShellConsoleOptionsProvider::declareOptionsImpl(
     std::shared_ptr<ProgramOptions> opts, ShellConsoleFeatureOptions& options) {
   opts->addOption("--quiet", "Silent startup.",
                   new BooleanParameter(&options.quiet));
+  opts->addOption("--connect", "whether to attempt to connect the server.",
+                  new BooleanParameter(&options.connect));
 
   opts->addSection("console", "console");
 
```

**File**: `client-tools/Shell/V8ClientConnection.cpp` (modified, +178/-162)
```diff
@@ -402,86 +402,105 @@ ResultT<std::string> V8ClientConnection::authenticateViaOpenAuth() {
   tempBuilder.endpoint(_client.endpoint());
 
   // Create connection without authentication
-  auto connection = tempBuilder.connect(_loop);
-  if (!connection) {
-    throw std::runtime_error("Failed to create connection for authentication");
-  }
+  try {
+    auto connection = tempBuilder.connect(_loop);
+    if (!connection) {
+      return ResultT<std::string>::error(
+          TRI_ERROR_SIMPLE_CLIENT_COULD_NOT_CONNECT,
+          "Failed to create connection for authentication");
+    }
+    // Prepare the authentication request
+    auto req = std::make_unique<fu::Request>();
+    req->header.restVerb = fu::RestVerb::Post;
+    req->header.path = "/_open/auth";
+    req->header.contentType(fu::ContentType::Json);
+    req->header.acceptType(fu::ContentType::Json);
+    req->timeout(
+        std::chrono::duration_cast<std::chrono::milliseconds>(_requestTimeout));
+
+    // Create JSON body with username and password
+    velocypack::Builder bodyBuilder;
+    bodyBuilder.openObject();
+    bodyBuilder.add("username", _client.username());
+    bodyBuilder.add("password", _client.password());
+    bodyBuilder.close();
+
+    // Add the JSON body to the request
+    std::string jsonBody = bodyBuilder.slice().toJson();
+    req->addBinary(reinterpret_cast<uint8_t const*>(jsonBody.data()),
+                   jsonBody.size());
+
+    // Send the request
+    auto response = connection->sendRequest(std::move(req));
+    if (!response) {
+      return ResultT<std::string>::error(
+          TRI_ERROR_FAILED, "Failed to send authentication request");
+    }
+    // Parse the response to extract the JWT token
+    if (response->payloadSize() == 0) {
+      if (response->statusCode() != fuerte::StatusOK) {
+        return ResultT<std::string>::error(
+            ::ErrorCode{static_cast<int>(response->statusCode())},
+            "Empty response from authentication endpoint");
+      } else {
+        return ResultT<std::string>::error(
+            TRI_ERROR_MALFORMED_JSON,
+            "Empty response from authentication endpoint");
+      }
+    }
 
-  // Prepare the authentication request
-  auto req = std::make_unique<fu::Request>();
-  req->header.restVerb = fu::RestVerb::Post;
-  req->header.path = "/_open/auth";
-  req->header.contentType(fu::ContentType::Json);
-  req->header.acceptType(fu::ContentType::Json);
-  req->timeout(
-      std::chrono::duration_cast<std::chrono::milliseconds>(_requestTimeout));
-
-  // Create JSON body with username and password
-  velocypack::Builder bodyBuilder;
-  bodyBuilder.openObject();
-  bodyBuilder.add("username", _client.username());
-  bodyBuilder.add("password", _client.password());
-  bodyBuilder.close();
-
-  // Add the JSON body to the request
-  std::string jsonBody = bodyBuilder.slice().toJson();
-  req->addBinary(reinterpret_cast<uint8_t const*>(jsonBody.data()),
-                 jsonBody.size());
-
-  // Send the request
-  auto response = connection->sendRequest(std::move(req));
-  if (!response) {
-    throw std::runtime_error("Failed to send authentication request");
-  }
-
-  if (response->statusCode() != fuerte::StatusOK) {
-    std::string errorMsg = "Authentication failed with status code: " +
-                           std::to_string(response->statusCode());
-    if (response->payloadSize() > 0) {
-      // Try to parse error message from response
-      try {
-        auto parsedBody = VPackParser::fromJson(
-            reinterpret_cast<char const*>(response->payload().data()),
-            response->payload().size());
-        auto slice = parsedBody->slice();
+    try {
+      auto parsedBody = VPackParser::fromJson(
+          reinterpret_cast<char const*>(response->payload().data()),
+          response->payload().size());
+      auto slice = parsedBody->slice();
+
+      if (response->statusCode() != fuerte::StatusOK) {
+        std::string errorMsg = "Authentication failed with status code: " +
+                               std::to_string(response->statusCode());
         if (slice.isObject() && slice.hasKey("errorMessage")) {
           errorMsg =
               VelocyPackHelper::getStringValue(slice, "errorMessage", errorMsg);
         }
 
         // This means that open/auth endpoint is not implemented and we are not
         // communicating to the coordinator
-        if (slice.hasKey("code") && slice.get("code").isNumber()) {
-          auto const errorCode = ErrorCode(slice.get("code").getNumber<int>());
+        if (slice.hasKey("code") && slice.get(StaticStrings::Code).isNumber()) {
+          auto const errorCode =
+              ErrorCode(slice.get(StaticStrings::Code).getNumber<int>());
           if (errorCode == TRI_ERROR_HTTP_NOT_IMPLEMENTED ||
               errorCode == TRI_ERROR_HTTP_NOT_FOUND) {
-            return {TRI_ERROR_ARANGO_TRY_AGAIN};
+            return ResultT<std::string>::error(TRI_ERROR_ARANGO_TRY_AGAIN, "");
```

**File**: `client-tools/Shell/V8ClientConnection.h` (modified, +4/-4)
```diff
@@ -74,9 +74,9 @@ class V8ClientConnection {
 
   bool isConnected() const;
 
-  void prepareConnection();
-  void connect();
-  void reconnect();
+  ResultT<std::string> prepareConnection();
+  ResultT<std::string> connect();
+  ResultT<std::string> reconnect();
 
 #ifdef ARANGODB_ENABLE_MAINTAINER_MODE
   void reconnectWithNewPassword(std::string const& password);
@@ -210,7 +210,7 @@ class V8ClientConnection {
   bool needsTokenRenewal();
 
   // Helper function to renew JWT token
-  void renewJwtToken();
+  ResultT<std::string> renewJwtToken();
 
   // Switches the connection to a --server.jwt-token that the ClientFeature
   // renewed in the background; no-op for all other authentication modes
```

**File**: `client-tools/Shell/V8ShellFeature.cpp` (modified, +3/-3)
```diff
@@ -496,7 +496,7 @@ ErrorCode V8ShellFeature::runShell(
   v8::Context::Scope context_scope{context};
 
   bool promptError;
-  setup(context, true, positionals, &promptError);
+  setup(context, console.shouldConnect(), positionals, &promptError);
 
   V8LineEditor v8LineEditor(
       _isolate, context, console.useHistory() ? "." + _name + ".history" : "");
@@ -723,6 +723,7 @@ bool V8ShellFeature::runScript(std::vector<std::string> const& files,
 bool V8ShellFeature::runString(std::vector<std::string> const& strings,
                                std::vector<std::string> const& positionals) {
   v8::Locker locker{_isolate};
+  ShellConsoleFeature& console = server().getFeature<ShellConsoleFeature>();
 
   v8::Isolate::Scope isolate_scope(_isolate);
   v8::HandleScope handle_scope(_isolate);
@@ -732,7 +733,7 @@ bool V8ShellFeature::runString(std::vector<std::string> const& strings,
 
   v8::Context::Scope context_scope{context};
 
-  setup(context, true, positionals);
+  setup(context, console.shouldConnect(), positionals);
 
   bool ok = true;
   for (auto const& script : strings) {
@@ -757,7 +758,6 @@ bool V8ShellFeature::runString(std::vector<std::string> const& strings,
     }
   }
 
-  ShellConsoleFeature& console = server().getFeature<ShellConsoleFeature>();
   console.flushLog();
 
   return ok;
```

**File**: `js/client/client.js` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@
 // @brief common globals
 // //////////////////////////////////////////////////////////////////////////////
 
+global.SYS_IS_V8_BUILD = true;
 global.Buffer = require('buffer').Buffer;
 global.process = require('process');
 global.setInterval = global.setInterval || function () {};
```

**File**: `js/client/modules/@arangodb/testsuites/arangosh.js` (modified, +1/-47)
```diff
@@ -256,6 +256,7 @@ function arangosh (options) {
   print('--------------------------------------------------------------------------------');
   let section = "testArangoshPipeThrough";
   let args = ct.makeArgs.arangosh(options);
+  args['connect'] = false;
   args['javascript.execute-string'] = "print(require('internal').pollStdin())";
 
   const startTime = time();
@@ -264,7 +265,6 @@ function arangosh (options) {
   sh.detectLogfiles(tmpMgr.tempDir, tmpMgr.tempDir);
   let res = executeExternal(pu.ARANGOSH_BIN, toArgv(args), true, sh.getSanOptions());
   const deltaTime = time() - startTime;
-
   fs.writePipe(res.pid, "bla\n");
   fs.closePipe(res.pid, false);
   let output = fs.readPipe(res.pid);
@@ -338,52 +338,6 @@ function arangosh (options) {
     print((echoSuccess ? GREEN : RED) + 'Status: ' + (echoSuccess ? 'SUCCESS' : 'FAIL') + RESET);
   }
 
-  // test shebang execution with arangosh
-  {
-    var shebangSuccess = true;
-    var deltaTime3 = 0;
-    var shebangFile = fs.getTempFile();
-
-    print('\n--------------------------------------------------------------------------------');
-    print('Starting arangosh via shebang script');
-    print('--------------------------------------------------------------------------------');
-
-    if (options.verbose) {
-      print(CYAN + 'shebang script: ' + shebangFile + RESET);
-    }
-
-    fs.write(shebangFile,
-             '#!' + fs.makeAbsolute(pu.ARANGOSH_BIN) + ' --javascript.execute \n' +
-             'print("hello world");\n');
-
-    executeExternalAndWait('sh', ['-c', 'chmod a+x ' + shebangFile]);
-
-    const startTime3 = time();
-    rc = executeExternalAndWaitWithSanitizer('sh', ['-c', shebangFile], 'arangosh_tests_shebang', options);
-    deltaTime3 = time() - startTime3;
-
-    if (options.verbose) {
-      print(CYAN + 'execute returned: ' + RESET, rc);
-    }
-
-    shebangSuccess = (rc.hasOwnProperty('exit') && rc.exit === 0);
-
-    if (!shebangSuccess) {
-      ret.failed += 1;
-      ret.testArangoshShebang.failed = 1;
-      ret.testArangoshShebang['message'] =
-        'didn\'t get expected return code (0): \n' +
-        yaml.safeDump(rc);
-    } else {
-      ret.testArangoshShebang.failed = 0;
-    }
-    fs.remove(shebangFile);
-  }
-  ++ret.testArangoshShebang['total'];
-  ret.testArangoshShebang['status'] = shebangSuccess;
-  ret.testArangoshShebang['duration'] = deltaTime3;
-  print((shebangSuccess ? GREEN : RED) + 'Status: ' + (shebangSuccess ? 'SUCCESS' : 'FAIL') + RESET);
-  print();
   return ret;
 }
 
```

---

### Incident Patch 2: `2c6300f7` (2026-10-05)
**Commit Message**: default global.SYS_IS_V8_BUILD to true rather than deleting it, so we can flip it later on if a SUT doesn't have V8 enabled

**File**: `js/client/client.js` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@
 // @brief common globals
 // //////////////////////////////////////////////////////////////////////////////
 
+global.SYS_IS_V8_BUILD = true;
 global.Buffer = require('buffer').Buffer;
 global.process = require('process');
 global.setInterval = global.setInterval || function () {};
```

**File**: `js/client/modules/@arangodb/arango-collection.js` (modified, +161/-99)
```diff
@@ -1,4 +1,5 @@
 /*jshint strict: false */
+/* global SYS_IS_V8_BUILD */
 
 // //////////////////////////////////////////////////////////////////////////////
 // / DISCLAIMER
@@ -724,12 +725,23 @@ ArangoCollection.prototype.exists = function (id, options) {
 // //////////////////////////////////////////////////////////////////////////////
 // / @brief gets a random element from the collection
 // //////////////////////////////////////////////////////////////////////////////
-ArangoCollection.prototype.any = function () {
-  let requestResult = this._database._connection.PUT(
-    this._prefixurl('/_api/simple/any'), { collection: this._name });
-  arangosh.checkRequestResult(requestResult);
-  return requestResult.document;
-};
+if (SYS_IS_V8_BUILD) {
+  ArangoCollection.prototype.any = function () {
+    let requestResult = this._database._connection.PUT(
+      this._prefixurl('/_api/simple/any'), { collection: this._name });
+    arangosh.checkRequestResult(requestResult);
+    return requestResult.document;
+  };
+} else {
+  ArangoCollection.prototype.any = function () {
+    let query = "FOR doc IN @@coll SORT RAND() LIMIT 1 RETURN doc";
+    let cursor = require('internal').db._query(query, {"@coll": this.name()});
+    if (cursor.hasNext()) {
+      return cursor.next();
+    }
+    return null;
+  };
+}
 
 // //////////////////////////////////////////////////////////////////////////////
 // / arangod/RestHandler/RestSimpleQueryHandler.cpp::buildExampleQuery
@@ -765,40 +777,52 @@ let buildExampleQuery = function(col, exampleDoc, skip, limit) {
 // / @brief constructs a query-by-example for a collection
 // //////////////////////////////////////////////////////////////////////////////
 
-ArangoCollection.prototype.firstExample = function (example) {
-  let e;
-  if (arguments.length === 1) {
-    // example is given as only argument
-    e = example;
-  } else {
-    // example is given as list
-    e = {};
+if (SYS_IS_V8_BUILD) {
+  ArangoCollection.prototype.firstExample = function (example) {
+    let e;
+    if (arguments.length === 1) {
+      // example is given as only argument
+      e = example;
+    } else {
+      // example is given as list
+      e = {};
 
-    for (let i = 0;  i < arguments.length;  i += 2) {
-      e[arguments[i]] = arguments[i + 1];
+      for (let i = 0;  i < arguments.length;  i += 2) {
+        e[arguments[i]] = arguments[i + 1];
+      }
     }
-  }
 
-  let data = {
-    collection: this.name(),
-    example: e
-  };
+    let data = {
+      collection: this.name(),
+      example: e
+    };
 
-  let requestResult = this._database._connection.PUT(
-    this._prefixurl('/_api/simple/first-example'),
-    data
-  );
+    let requestResult = this._database._connection.PUT(
+      this._prefixurl('/_api/simple/first-example'),
+      data
+    );
 
-  if (requestResult !== null
-      && requestResult.error === true
-      && requestResult.errorNum === internal.errors.ERROR_HTTP_NOT_FOUND.code) {
-    return null;
-  }
+    if (requestResult !== null
+        && requestResult.error === true
+        && requestResult.errorNum === internal.errors.ERROR_HTTP_NOT_FOUND.code) {
+      return null;
+    }
 
-  arangosh.checkRequestResult(requestResult);
+    arangosh.checkRequestResult(requestResult);
 
-  return requestResult.document;
-};
+    return requestResult.document;
+  };
+} else {
+  ArangoCollection.prototype.firstExample = function (example) {
+    let query = buildExampleQuery(this.name(), example, 0, 1);
+    query.query += " RETURN doc";
+    let cursor = require('internal').db._query(query);
+    if (cursor.hasNext()) {
+      return cursor.next();
+    }
+    return null;
+  };
+}
 
 // //////////////////////////////////////////////////////////////////////////////
 // / @brief saves a document in the collection
@@ -1299,94 +1323,132 @@ ArangoCollection.prototype.outEdges = function (vertex) {
 // / @brief removes documents matching an example
 // //////////////////////////////////////////////////////////////////////////////
 
-ArangoCollection.prototype.removeByExample = function (example,
-                                                       waitForSync, limit) {
-  let data = {
-    collection: this._name,
-    example: example,
-    waitForSync: waitForSync,
-    limit: limit
-  };
-
-  if (typeof waitForSync === 'object') {
-    if (typeof limit !== 'undefined') {
-      throw 'too many parameters';
-    }
-    data = {
+if (SYS_IS_V8_BUILD) {
+  ArangoCollection.prototype.removeByExample = function (example,
+                                                         waitForSync, limit) {
+    let data = {
       collection: this._name,
       example: example,
-      options: waitForSync
+      waitForSync: waitForSync,
+      limit: limit
     };
-  }
 
-  let requestResult = this._database._connection.PUT(
-    this._prefixurl('/_api/simple/remove-by-example'), data);
-  arangosh.checkRequestResult(requestResult);
-  return requestResult.deleted;

```

**File**: `js/client/modules/@arangodb/simple-query.js` (modified, +66/-29)
```diff
@@ -1,4 +1,5 @@
 /* jshint strict: false */
+/* global SYS_IS_V8_BUILD */
 
 // //////////////////////////////////////////////////////////////////////////////
 // / DISCLAIMER
@@ -194,45 +195,81 @@ SimpleQueryByCondition.prototype.execute = function (batchSize) {
 // / @brief executes a range query
 // //////////////////////////////////////////////////////////////////////////////
 
-SimpleQueryRange.prototype.execute = function (batchSize) {
-  if (this._execution === null) {
-    if (batchSize !== undefined && batchSize > 0) {
-      this._batchSize = batchSize;
-    }
+if (SYS_IS_V8_BUILD) {
+  SimpleQueryRange.prototype.execute = function (batchSize) {
+    if (this._execution === null) {
+      if (batchSize !== undefined && batchSize > 0) {
+        this._batchSize = batchSize;
+      }
 
-    var data = {
-      collection: this._collection.name(),
-      attribute: this._attribute,
-      right: this._right,
-      left: this._left,
-      closed: this._type === 1
-    };
+      var data = {
+        collection: this._collection.name(),
+        attribute: this._attribute,
+        right: this._right,
+        left: this._left,
+        closed: this._type === 1
+      };
 
-    if (this._limit !== null) {
-      data.limit = this._limit;
-    }
+      if (this._limit !== null) {
+        data.limit = this._limit;
+      }
 
-    if (this._skip !== null) {
-      data.skip = this._skip;
-    }
+      if (this._skip !== null) {
+        data.skip = this._skip;
+      }
 
-    if (this._batchSize !== null) {
-      data.batchSize = this._batchSize;
-    }
+      if (this._batchSize !== null) {
+        data.batchSize = this._batchSize;
+      }
 
-    var requestResult = this._collection._database._connection.PUT(
-      '/_api/simple/range', data);
+      var requestResult = this._collection._database._connection.PUT(
+        '/_api/simple/range', data);
 
-    arangosh.checkRequestResult(requestResult);
+      arangosh.checkRequestResult(requestResult);
 
-    this._execution = new ArangoQueryCursor(this._collection._database, requestResult);
+      this._execution = new ArangoQueryCursor(this._collection._database, requestResult);
 
-    if (requestResult.hasOwnProperty('count')) {
-      this._countQuery = requestResult.count;
+      if (requestResult.hasOwnProperty('count')) {
+        this._countQuery = requestResult.count;
+      }
     }
-  }
-};
+  };
+} else {
+  var limitString = function (skip, limit) {
+    if (skip > 0 || limit > 0) {
+      if (limit <= 0) {
+        limit = 99999999999;
+      }
+      return 'LIMIT ' + parseInt(skip, 10) + ', ' + parseInt(limit, 10) + ' ';
+    }
+    return '';
+  };
+  SimpleQueryRange.prototype.execute = function (batchSize) {
+    if (this._execution === null) {
+      if (batchSize !== undefined && batchSize > 0) {
+        this._batchSize = batchSize;
+      }
+      var query = 'FOR doc IN @@collection ';
+      var bindVars = {
+        '@collection': this._collection.name(),
+        attribute: this._attribute,
+        left: this._left,
+        right: this._right
+      };
+
+      if (this._type === 0) {
+        query += 'FILTER doc.@attribute >= @left && doc.@attribute < @right ';
+      } else if (this._type === 1) {
+        query += 'FILTER doc.@attribute >= @left && doc.@attribute <= @right ';
+      } else {
+        throw 'unknown type';
+      }
 
+      query += limitString(this._skip, this._limit) + ' RETURN doc';
+      this._execution = require('internal').db._query({ query, bindVars});
+    }
+  };
+}
 // //////////////////////////////////////////////////////////////////////////////
 // / @brief executes a near query
 // //////////////////////////////////////////////////////////////////////////////
```

---

### Incident Patch 3: `dda35c20` (2026-10-02)
**Commit Message**: fix string formatting

**File**: `client-tools/Shell/V8ClientConnection.cpp` (modified, +1/-1)
```diff
@@ -1082,7 +1082,7 @@ static void ClientConnection_reconnect(
   if (!v8security.isAllowedToConnectToUrl(isolate, endpoint)) {
     TRI_V8_THROW_EXCEPTION_MESSAGE(
         TRI_ERROR_FORBIDDEN,
-        absl::StrCat("not allowed to connect to this endpoint", endpoint));
+        absl::StrCat("not allowed to connect to this endpoint: ", endpoint));
   }
 
   if (args.Length() > 5 && !args[5]->IsUndefined()) {
```

---

### Incident Patch 4: `037c3861` (2026-10-02)
**Commit Message**: fix reconnect error handling

**File**: `client-tools/Shell/V8ClientConnection.cpp` (modified, +14/-10)
```diff
@@ -641,16 +641,15 @@ ResultT<std::string> V8ClientConnection::connect() {
   return res;
 }
 
-void V8ClientConnection::reconnect() {
+ResultT<std::string> V8ClientConnection::reconnect() {
   std::lock_guard<std::recursive_mutex> guard(_lock);
 
   std::string oldConnectionId = connectionIdentifier(_connectedBuilder);
 
   auto res = prepareConnection();
-  // if (!res.ok()) {
-  //   _lastErrorMessage = res.errorMessage();
-  //   throw std::runtime_error(_lastErrorMessage);
-  // }
+  if (!res.ok()) {
+    return res;
+  }
 
   std::shared_ptr<fu::Connection> oldConnection;
   _connection.swap(oldConnection);
@@ -672,7 +671,8 @@ void V8ClientConnection::reconnect() {
   try {
     createConnection();
   } catch (...) {
-    throw std::runtime_error("error in '" + _client.endpoint() + "'");
+    return ResultT<std::string>::error(TRI_ERROR_FAILED,
+                                       "error in '" + _client.endpoint() + "'");
   }
 
   if (isConnected() &&
@@ -688,10 +688,11 @@ void V8ClientConnection::reconnect() {
           << "', username: '" << _client.username()
           << "' - Server message: " << _lastErrorMessage;
     }
-
-    throw std::runtime_error(!_lastErrorMessage.empty() ? _lastErrorMessage
-                                                        : "could not connect");
+    return ResultT<std::string>::error(
+        TRI_ERROR_FAILED,
+        !_lastErrorMessage.empty() ? _lastErrorMessage : "could not connect");
   }
+  return ResultT<std::string>::success("");
 }
 
 std::string V8ClientConnection::getHandle() { return _currentConnectionId; }
@@ -1099,7 +1100,10 @@ static void ClientConnection_reconnect(
   client->setWarnConnect(warnConnect);
 
   try {
-    v8connection->reconnect();
+    auto res = v8connection->reconnect();
+    if (!res.ok()) {
+      TRI_V8_THROW_EXCEPTION_MESSAGE(res.errorNumber(), res.errorMessage());
+    }
   } catch (std::exception const& ex) {
     TRI_V8_THROW_EXCEPTION_PARAMETER(ex.what());
   } catch (...) {
```

**File**: `client-tools/Shell/V8ClientConnection.h` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ class V8ClientConnection {
 
   ResultT<std::string> prepareConnection();
   ResultT<std::string> connect();
-  void reconnect();
+  ResultT<std::string> reconnect();
 
 #ifdef ARANGODB_ENABLE_MAINTAINER_MODE
   void reconnectWithNewPassword(std::string const& password);
```

---

### Incident Patch 5: `77334cc4` (2026-10-01)
**Commit Message**: fix arangosh self tests, disable shebang test. We don't need that anyways

**File**: `client-tools/Shell/ShellConsoleFeature.h` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ class ShellConsoleFeature final
   void start() override final;
   void unprepare() override final;
 
+  bool connect() const { return _options.connect; }
   bool quiet() const { return _options.quiet; }
   void setQuiet(bool value) { _options.quiet = value; }
   bool colors() const { return _options.colors; }
```

**File**: `client-tools/Shell/ShellConsoleFeatureOptions.h` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ namespace arangodb {
 
 struct ShellConsoleFeatureOptions {
   bool quiet = false;
+  bool connect = true;
   bool colors = true;
   bool useHistory = true;
   bool autoComplete = true;
```

**File**: `client-tools/Shell/ShellConsoleOptionsProvider.cpp` (modified, +2/-0)
```diff
@@ -34,6 +34,8 @@ void ShellConsoleOptionsProvider::declareOptionsImpl(
     std::shared_ptr<ProgramOptions> opts, ShellConsoleFeatureOptions& options) {
   opts->addOption("--quiet", "Silent startup.",
                   new BooleanParameter(&options.quiet));
+  opts->addOption("--connect", "whether to attempt to connect the server.",
+                  new BooleanParameter(&options.connect));
 
   opts->addSection("console", "console");
 
```

**File**: `client-tools/Shell/V8ShellFeature.cpp` (modified, +3/-3)
```diff
@@ -496,7 +496,7 @@ ErrorCode V8ShellFeature::runShell(
   v8::Context::Scope context_scope{context};
 
   bool promptError;
-  setup(context, true, positionals, &promptError);
+  setup(context, console.connect(), positionals, &promptError);
 
   V8LineEditor v8LineEditor(
       _isolate, context, console.useHistory() ? "." + _name + ".history" : "");
@@ -723,6 +723,7 @@ bool V8ShellFeature::runScript(std::vector<std::string> const& files,
 bool V8ShellFeature::runString(std::vector<std::string> const& strings,
                                std::vector<std::string> const& positionals) {
   v8::Locker locker{_isolate};
+  ShellConsoleFeature& console = server().getFeature<ShellConsoleFeature>();
 
   v8::Isolate::Scope isolate_scope(_isolate);
   v8::HandleScope handle_scope(_isolate);
@@ -732,7 +733,7 @@ bool V8ShellFeature::runString(std::vector<std::string> const& strings,
 
   v8::Context::Scope context_scope{context};
 
-  setup(context, true, positionals);
+  setup(context, console.connect(), positionals);
 
   bool ok = true;
   for (auto const& script : strings) {
@@ -757,7 +758,6 @@ bool V8ShellFeature::runString(std::vector<std::string> const& strings,
     }
   }
 
-  ShellConsoleFeature& console = server().getFeature<ShellConsoleFeature>();
   console.flushLog();
 
   return ok;
```

**File**: `js/client/modules/@arangodb/arango-collection.js` (modified, +5/-6)
```diff
@@ -1,5 +1,4 @@
 /*jshint strict: false */
-/* global SYS_IS_V8_BUILD */
 
 // //////////////////////////////////////////////////////////////////////////////
 // / DISCLAIMER
@@ -725,7 +724,7 @@ ArangoCollection.prototype.exists = function (id, options) {
 // //////////////////////////////////////////////////////////////////////////////
 // / @brief gets a random element from the collection
 // //////////////////////////////////////////////////////////////////////////////
-if (SYS_IS_V8_BUILD) {
+if (false) {
   ArangoCollection.prototype.any = function () {
     let requestResult = this._database._connection.PUT(
       this._prefixurl('/_api/simple/any'), { collection: this._name });
@@ -777,7 +776,7 @@ let buildExampleQuery = function(col, exampleDoc, skip, limit) {
 // / @brief constructs a query-by-example for a collection
 // //////////////////////////////////////////////////////////////////////////////
 
-if (SYS_IS_V8_BUILD) {
+if (false) {
   ArangoCollection.prototype.firstExample = function (example) {
     let e;
     if (arguments.length === 1) {
@@ -1323,7 +1322,7 @@ ArangoCollection.prototype.outEdges = function (vertex) {
 // / @brief removes documents matching an example
 // //////////////////////////////////////////////////////////////////////////////
 
-if (SYS_IS_V8_BUILD) {
+if (false) {
   ArangoCollection.prototype.removeByExample = function (example,
                                                          waitForSync, limit) {
     let data = {
@@ -1364,7 +1363,7 @@ if (SYS_IS_V8_BUILD) {
 // / @brief replaces documents matching an example
 // //////////////////////////////////////////////////////////////////////////////
 
-if (SYS_IS_V8_BUILD) {
+if (false) {
   ArangoCollection.prototype.replaceByExample = function (example,
                                                           newValue, waitForSync, limit) {
     let data = {
@@ -1408,7 +1407,7 @@ if (SYS_IS_V8_BUILD) {
 // / @brief updates documents matching an example
 // //////////////////////////////////////////////////////////////////////////////
 
-if (SYS_IS_V8_BUILD) {
+if (false) {
   ArangoCollection.prototype.updateByExample = function (example,
                                                          newValue, keepNull, waitForSync, limit) {
     let data = {
```

**File**: `js/client/modules/@arangodb/simple-query.js` (modified, +1/-2)
```diff
@@ -1,5 +1,4 @@
 /* jshint strict: false */
-/* global SYS_IS_V8_BUILD */
 
 // //////////////////////////////////////////////////////////////////////////////
 // / DISCLAIMER
@@ -195,7 +194,7 @@ SimpleQueryByCondition.prototype.execute = function (batchSize) {
 // / @brief executes a range query
 // //////////////////////////////////////////////////////////////////////////////
 
-if (SYS_IS_V8_BUILD) {
+if (false) {
   SimpleQueryRange.prototype.execute = function (batchSize) {
     if (this._execution === null) {
       if (batchSize !== undefined && batchSize > 0) {
```

**File**: `js/client/modules/@arangodb/testsuites/arangosh.js` (modified, +6/-6)
```diff
@@ -256,6 +256,7 @@ function arangosh (options) {
   print('--------------------------------------------------------------------------------');
   let section = "testArangoshPipeThrough";
   let args = ct.makeArgs.arangosh(options);
+  args['connect'] = false;
   args['javascript.execute-string'] = "print(require('internal').pollStdin())";
 
   const startTime = time();
@@ -264,7 +265,6 @@ function arangosh (options) {
   sh.detectLogfiles(tmpMgr.tempDir, tmpMgr.tempDir);
   let res = executeExternal(pu.ARANGOSH_BIN, toArgv(args), true, sh.getSanOptions());
   const deltaTime = time() - startTime;
-
   fs.writePipe(res.pid, "bla\n");
   fs.closePipe(res.pid, false);
   let output = fs.readPipe(res.pid);
@@ -339,7 +339,7 @@ function arangosh (options) {
   }
 
   // test shebang execution with arangosh
-  {
+  if (false) { // connection handling being disabled makes this nice to have feature untesteable.
     var shebangSuccess = true;
     var deltaTime3 = 0;
     var shebangFile = fs.getTempFile();
@@ -378,11 +378,11 @@ function arangosh (options) {
       ret.testArangoshShebang.failed = 0;
     }
     fs.remove(shebangFile);
+    ++ret.testArangoshShebang['total'];
+    ret.testArangoshShebang['status'] = shebangSuccess;
+    ret.testArangoshShebang['duration'] = deltaTime3;
+    print((shebangSuccess ? GREEN : RED) + 'Status: ' + (shebangSuccess ? 'SUCCESS' : 'FAIL') + RESET);
   }
-  ++ret.testArangoshShebang['total'];
-  ret.testArangoshShebang['status'] = shebangSuccess;
-  ret.testArangoshShebang['duration'] = deltaTime3;
-  print((shebangSuccess ? GREEN : RED) + 'Status: ' + (shebangSuccess ? 'SUCCESS' : 'FAIL') + RESET);
   print();
   return ret;
 }
```

**File**: `js/client/modules/@arangodb/testsuites/python-arango.js` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 /* jshint strict: false, sub: true */
-/* global print, db, SYS_IS_V8_BUILD */
+/* global print, db */
 'use strict';
 
 // //////////////////////////////////////////////////////////////////////////////
@@ -105,7 +105,7 @@ class runInPythonTest extends runWithAllureReport {
     if (!this.options.cluster) {
       testSkipList.push('backup');
     }
-    if (true) { //!SYS_IS_V8_BUILD) {
+    if (true) {
       testSkipList.push('foxx');
       //testSkipList.push('tasks');
       testSkipList.push('js-transactions');
```

---

### Incident Patch 6: `62fd3836` (2026-10-05)
**Commit Message**: Merge pull request #23404 from arangodb/bug-fix/cor-1054-find-returns-control-characters

[COR-1054] `FIND_FIRST` and `FIND_LAST` can find control characters

**File**: `arangod/Aql/Function/StringFunctions.cpp` (modified, +8/-8)
```diff
@@ -268,14 +268,14 @@ AqlValue functions::FindFirst(ExpressionContext* expressionContext,
 
   for (int pos = search.first(status); U_SUCCESS(status) && pos != USEARCH_DONE;
        pos = search.next(status)) {
-    if (U_FAILURE(status)) {
-      registerICUWarning(expressionContext, AFN, status);
-      return AqlValue(AqlValueHintNull());
-    }
     if ((pos >= startOffset) && ((pos + searchLen - 1) <= maxEnd)) {
       return AqlValue(AqlValueHintInt(pos));
     }
   }
+  if (U_FAILURE(status)) {
+    registerICUWarning(expressionContext, AFN, status);
+    return AqlValue(AqlValueHintNull());
+  }
   return AqlValue(AqlValueHintInt(-1));
 }
 
@@ -347,14 +347,14 @@ AqlValue functions::FindLast(ExpressionContext* expressionContext,
   int foundPos = -1;
   for (int pos = search.first(status); U_SUCCESS(status) && pos != USEARCH_DONE;
        pos = search.next(status)) {
-    if (U_FAILURE(status)) {
-      registerICUWarning(expressionContext, AFN, status);
-      return AqlValue(AqlValueHintNull());
-    }
     if ((pos >= startOffset) && ((pos + searchLen - 1) <= maxEnd)) {
       foundPos = pos;
     }
   }
+  if (U_FAILURE(status)) {
+    registerICUWarning(expressionContext, AFN, status);
+    return AqlValue(AqlValueHintNull());
+  }
   return AqlValue(AqlValueHintInt(foundPos));
 }
 
```

---

### Incident Patch 7: `f88247a5` (2026-10-02)
**Commit Message**: Merge branch 'devel' into bug-fix/cor-1054-find-returns-control-characters

**File**: `.circleci/base_config.yml` (modified, +138/-1)
```diff
@@ -413,6 +413,77 @@ commands:
 
             curl -s -L -o <<parameters.repo-path>>/build/bin/rclone-arangodb "https://github.com/arangodb/rclone-arangodb/releases/download/golang-${RCLONE_GO}/golang-${RCLONE_GO}_${ARANGO_MAJOR_MINOR_VERSION}_v${RCLONE_VERSION}_rclone-arangodb-linux-$arch"
             chmod a+x <<parameters.repo-path>>/build/bin/rclone-arangodb
+  provision-rbac-sidecar:
+    description: >
+      Downloads the `arangodb_operator` binary when it exists or builds it
+      from source when it does not. See
+      tests/api/rbac/scripts/provision_operator_sidecar.sh for why building is
+      currently the normal outcome.
+    parameters:
+      arch:
+        type: string
+        # Empty means "detect from uname"
+        default: ""
+      operator-repo:
+        type: string
+        default: "https://github.com/arangodb/kube-arangodb.git"
+      operator-ref:
+        type: string
+        default: master
+    steps:
+      - run:
+          name: Provision the authorization sidecar binary
+          # Build takes a few minutes and produces no output.
+          no_output_timeout: 20m
+          command: |
+            set -eo pipefail
+            missing=""
+            for tool in curl python3 tar unshare; do
+              command -v "$tool" >/dev/null 2>&1 || missing="$missing $tool"
+            done
+            if [ -n "$missing" ]; then
+              echo "this image is missing:$missing - the RBAC stack scripts need them" >&2
+              exit 1
+            fi
+            if ! unshare --map-root-user --mount "${BASH:-bash}" -c : 2>/dev/null; then
+              echo "this executor cannot create a user+mount namespace, which the" >&2
+              echo "authorization sidecar needs for a writable /run." >&2
+              echo "Either run this job on a machine executor (as run-rta-tests" >&2
+              echo "does) or use an image/seccomp profile that permits" >&2
+              echo "unshare(CLONE_NEWUSER|CLONE_NEWNS)." >&2
+              exit 1
+            fi
+            export RBAC_OPERATOR_DIR="$HOME/rbac-operator"
+            OPERATOR_PATH="$(tests/api/rbac/scripts/provision_operator_sidecar.sh \
+              --arch '<< parameters.arch >>' \
+              --repo '<< parameters.operator-repo >>' \
+              --ref '<< parameters.operator-ref >>')"
+            echo "export OPERATOR='$OPERATOR_PATH'" >> "$BASH_ENV"
+            echo "provisioned: $OPERATOR_PATH"
+
+  start-rbac-stack:
+    description: >
+      Launch the authorization sidecar and the arangod that stores its policies.
+      Must run AFTER the build artifacts are attached, because it starts arangod
+      from build/bin - hence run-test's pre-test-steps rather than a step before
+      it, which is where the driver tests put their setup.
+    parameters:
+      rbac-work:
+        type: string
+        default: /tmp/rbac-stack
+    steps:
+      - run:
+          name: Start the RBAC authorization stack
+          no_output_timeout: 10m
+          command: |
+            set -eo pipefail
+            if [ -z "${OPERATOR:-}" ]; then
+              echo "OPERATOR is not set - provision-rbac-sidecar must run first" >&2
+              exit 1
+            fi
+            export RBAC_WORK="<< parameters.rbac-work >>"
+            tests/api/rbac/scripts/start_stack_for_unittest.sh
+
   run-test:
     parameters:
       suiteName:
@@ -432,6 +503,9 @@ commands:
       use-s3-workspace:
         type: boolean
         default: true
+      pre-test-steps:
+        type: steps
+        default: []
     steps:
       - add_ssh_keys:
           fingerprints:
@@ -474,6 +548,7 @@ commands:
                 name: Symbolizer server
                 command: ./utils/llvm-symbolizer-server.py
                 background: true
+      - steps: << parameters.pre-test-steps >>
       - run:
           name: Run << parameters.suiteName >> tests
           # we increase the no_output_timeout so our own timeout mechanism can kick in and gather more information
@@ -1035,7 +1110,6 @@ jobs:
                   build/compile_commands.json
                   tidy-headers
             - persist_workspace_to_s3:
-                # not there? install.tar.gz
                 root: .
                 archive: binaries.tar.gz
                 paths: |
@@ -1049,6 +1123,8 @@ jobs:
                   etc/
                   tests/js
                   enterprise/tests/js
+                  tests/api/rbac
+                  arangod/Auth/Rbac/ServiceImpl.cpp
                   utils
                   lib/iresearch/tests/resources
                   3rdParty/rta-makedata
@@ -1337,6 +1413,67 @@ jobs:
           steps:
             - store_cache
 
+  run-rbac-tests:
+    description: >
+      rta_makedata under RBAC, against a real authorization sidecar.
+
+      Shaped like run-driver-tests - extra setup bolted onto run-test - with one
+      difference that matters: the driver clone needs no build artifacts and so
+      happens befo
```

**File**: `3rdParty/rta-makedata` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit c4e83269f5c125ac921ef4d1d8dd3cfb6303682a
+Subproject commit ba2177bc9b5dd31b221abc4e42f2745d4765c3a9
```

**File**: `CHANGELOG` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 3.12.13 (XXXX-XX-XX)
 --------------------
+
+* Updated node modules:
+ - brace-expansion to 5.0.12 to resolve CVE-2026-102276, CVE-2026-102277
+   and CVE-2026-102278
+ - fast-uri to 3.1.8 to resolve CVE-2026-86472
+
 * COR-1012 The client tools started with `--server.username`/`--server.password`
   now obtain a JWT via `POST /_open/auth` like arangosh and renew it before
   it expires, which also makes them work against servers in RBAC mode; they
```

**File**: `LICENSES-OTHER-COMPONENTS.md` (modified, +2/-2)
```diff
@@ -1102,7 +1102,7 @@ License Id: -
 #### brace-expansion
 
 * Name: brace-expansion
-* Version: 5.0.9
+* Version: 5.0.12
 * Project Home: <https://github.com/juliangruber/brace-expansion>
 * License: <https://raw.githubusercontent.com/juliangruber/brace-expansion/main/LICENSE>
 * License Name: MIT License
@@ -1281,7 +1281,7 @@ License Id: -
 #### fast-uri
 
 * Name: fast-uri
-* Version: 3.1.7
+* Version: 3.1.8
 * Project Home: <https://github.com/fastify/fast-uri>
 * License: <https://raw.githubusercontent.com/fastify/fast-uri/main/LICENSE>
 * License Name: BSD-style 3-Clause License
```

**File**: `arangod/Aql/CMakeLists.txt` (modified, +1/-0)
```diff
@@ -92,6 +92,7 @@ add_library(arango_aql STATIC
   QueryString.cpp
   QueryWarnings.cpp
   Range.cpp
+  RangeSpec.cpp
   RegisterId.cpp
   RegisterInfos.cpp
   RegisterPlan.cpp
```

**File**: `arangod/Aql/Function/ArrayFunctions.cpp` (modified, +9/-26)
```diff
@@ -27,6 +27,7 @@
 #include "Aql/Function.h"
 #include "Aql/Functions.h"
 #include "Aql/Range.h"
+#include "Aql/RangeSpec.h"
 #include "Basics/Exceptions.h"
 #include "Basics/VelocyPackHelper.h"
 #include "Basics/debugging.h"
@@ -39,6 +40,9 @@
 #include <velocypack/Iterator.h>
 #include <velocypack/Slice.h>
 
+#include <algorithm>
+#include <cmath>
+#include <limits>
 #include <list>
 #include <set>
 #include <unordered_map>
@@ -721,39 +725,18 @@ AqlValue functions::Range(ExpressionContext* expressionContext, AstNode const&,
     return AqlValue(left.toInt64(), right.toInt64());
   }
 
-  double step = stepValue.toDouble();
-
-  if (step == 0.0 || (from < to && step < 0.0) || (from > to && step > 0.0)) {
+  auto spec = functions::makeRangeSpec(from, to, stepValue.toDouble());
+  if (!spec) {
     registerWarning(expressionContext, AFN,
                     TRI_ERROR_QUERY_FUNCTION_ARGUMENT_TYPE_MISMATCH);
     return AqlValue(AqlValueHintNull());
   }
+  Range::throwIfTooBigForMaterialization(spec->count);
 
   auto builder = ThreadLocalBuilderLeaser::lease();
   builder->openArray(true);
-  // TODO(COR-938): Fix the float-loop-counter and maybe the one-off
-  if (step < 0.0 && to <= from) {
-    TRI_ASSERT(step != 0.0);
-    Range::throwIfTooBigForMaterialization(
-        static_cast<uint64_t>((from - to) / -step));
-    // NOLINTBEGIN(clang-analyzer-security.FloatLoopCounter)
-    // NOLINTBEGIN(bugprone-float-loop-counter)
-    for (; from >= to; from += step) {
-      builder->add(VPackValue(from));
-    }
-    // NOLINTEND(bugprone-float-loop-counter)
-    // NOLINTEND(clang-analyzer-security.FloatLoopCounter)
-  } else {
-    TRI_ASSERT(step != 0.0);
-    Range::throwIfTooBigForMaterialization(
-        static_cast<uint64_t>((to - from) / step));
-    // NOLINTBEGIN(clang-analyzer-security.FloatLoopCounter)
-    // NOLINTBEGIN(bugprone-float-loop-counter)
-    for (; from <= to; from += step) {
-      builder->add(VPackValue(from));
-    }
-    // NOLINTEND(bugprone-float-loop-counter)
-    // NOLINTEND(clang-analyzer-security.FloatLoopCounter)
+  for (uint64_t i = 0; i < spec->count; ++i) {
+    builder->add(VPackValue(spec->at(i)));
   }
   builder->close();
   return AqlValue(builder->slice(), builder->size());
```

**File**: `arangod/Aql/RangeSpec.cpp` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+////////////////////////////////////////////////////////////////////////////////
+/// DISCLAIMER
+///
+/// Copyright 2014-2024 ArangoDB GmbH, Cologne, Germany
+/// Copyright 2004-2014 triAGENS GmbH, Cologne, Germany
+///
+/// Licensed under the Business Source License 1.1 (the "License");
+/// you may not use this file except in compliance with the License.
+/// You may obtain a copy of the License at
+///
+///     https://github.com/arangodb/arangodb/blob/devel/LICENSE
+///
+/// Unless required by applicable law or agreed to in writing, software
+/// distributed under the License is distributed on an "AS IS" BASIS,
+/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+/// See the License for the specific language governing permissions and
+/// limitations under the License.
+///
+/// Copyright holder is ArangoDB GmbH, Cologne, Germany
+///
+////////////////////////////////////////////////////////////////////////////////
+
+#include "Aql/Range.h"
+#include "Aql/RangeSpec.h"
+
+#include <cmath>
+#include <limits>
+#include <algorithm>
+
+namespace arangodb::aql::functions {
+
+std::optional<RangeSpec> makeRangeSpec(double from, double to, double step) {
+  if (!std::isfinite(from) || !std::isfinite(to) || !std::isfinite(step) ||
+      step == 0.0 || (from < to && step < 0.0) || (from > to && step > 0.0)) {
+    return std::nullopt;
+  }
+
+  // epsilon is the smallest representable gap between 1.0 and the next double;
+  // times the operand, which gives one ulp (the gap on that scale);
+  // `from`, `to`, and `step` are possible to contain 0.5 ulp empirically;
+  // and the subtract and divide add 0.5 each, which can land ~2.5 ulp;
+  // therefore, 4 * ulp can absorb the floating point errors.
+  double const rawTol =
+      4 * std::numeric_limits<double>::epsilon() *
+      std::max({std::abs(from), std::abs(to), std::abs(step)});
+  // Sometimes, the calculated tol (`rawTol`) is larger than `step`, which
+  // produces extra elements; therefore, we cap the `tol` by `step` here.
+  double const tol = std::copysign(std::min(rawTol, std::abs(step) / 2), step);
+
+  // if `count` is an integer, it can be infinite -> UB; so we use double here
+  double const count = std::floor((to - from + tol) / step) + 1.0;
+  uint64_t const n = (count <= static_cast<double>(Range::MaterializationLimit))
+                         ? static_cast<uint64_t>(count)
+                         : Range::MaterializationLimit + 1;
+
+  return RangeSpec{from, step, n};
+}
+
+}  // namespace arangodb::aql::functions
```

**File**: `arangod/Aql/RangeSpec.h` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+////////////////////////////////////////////////////////////////////////////////
+/// DISCLAIMER
+///
+/// Copyright 2014-2024 ArangoDB GmbH, Cologne, Germany
+/// Copyright 2004-2014 triAGENS GmbH, Cologne, Germany
+///
+/// Licensed under the Business Source License 1.1 (the "License");
+/// you may not use this file except in compliance with the License.
+/// You may obtain a copy of the License at
+///
+///     https://github.com/arangodb/arangodb/blob/devel/LICENSE
+///
+/// Unless required by applicable law or agreed to in writing, software
+/// distributed under the License is distributed on an "AS IS" BASIS,
+/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+/// See the License for the specific language governing permissions and
+/// limitations under the License.
+///
+/// Copyright holder is ArangoDB GmbH, Cologne, Germany
+///
+////////////////////////////////////////////////////////////////////////////////
+
+#pragma once
+
+#include <cstdint>
+#include <optional>
+
+namespace arangodb::aql::functions {
+
+struct RangeSpec {
+  double from;
+  double step;
+  uint64_t count;
+
+  double at(uint64_t i) const noexcept {
+    return from + static_cast<double>(i) * step;
+  }
+};
+
+std::optional<RangeSpec> makeRangeSpec(double from, double to, double step);
+
+}  // namespace arangodb::aql::functions
```

---

### Incident Patch 8: `e0de8b01` (2026-10-02)
**Commit Message**: Revive dead code: error catch that's never triggered inside for loop

**File**: `arangod/Aql/Function/StringFunctions.cpp` (modified, +8/-8)
```diff
@@ -268,14 +268,14 @@ AqlValue functions::FindFirst(ExpressionContext* expressionContext,
 
   for (int pos = search.first(status); U_SUCCESS(status) && pos != USEARCH_DONE;
        pos = search.next(status)) {
-    if (U_FAILURE(status)) {
-      registerICUWarning(expressionContext, AFN, status);
-      return AqlValue(AqlValueHintNull());
-    }
     if ((pos >= startOffset) && ((pos + searchLen - 1) <= maxEnd)) {
       return AqlValue(AqlValueHintInt(pos));
     }
   }
+  if (U_FAILURE(status)) {
+    registerICUWarning(expressionContext, AFN, status);
+    return AqlValue(AqlValueHintNull());
+  }
   return AqlValue(AqlValueHintInt(-1));
 }
 
@@ -347,14 +347,14 @@ AqlValue functions::FindLast(ExpressionContext* expressionContext,
   int foundPos = -1;
   for (int pos = search.first(status); U_SUCCESS(status) && pos != USEARCH_DONE;
        pos = search.next(status)) {
-    if (U_FAILURE(status)) {
-      registerICUWarning(expressionContext, AFN, status);
-      return AqlValue(AqlValueHintNull());
-    }
     if ((pos >= startOffset) && ((pos + searchLen - 1) <= maxEnd)) {
       foundPos = pos;
     }
   }
+  if (U_FAILURE(status)) {
+    registerICUWarning(expressionContext, AFN, status);
+    return AqlValue(AqlValueHintNull());
+  }
   return AqlValue(AqlValueHintInt(foundPos));
 }
 
```

---

### Incident Patch 9: `42399904` (2026-10-02)
**Commit Message**: Revert "Add handling for no weight character; add tests for them"

This reverts commit 9da8cf44d2b16ec35436f57401ce6e14a22f08fc.

**File**: `arangod/Aql/Function/StringFunctions.cpp` (modified, +0/-34)
```diff
@@ -115,22 +115,6 @@ void rtrimInternal(int32_t& startOffset, int32_t& endOffset,
   }  // for
 }
 
-// Most control characters (like backspace)' collation weights are zeros;
-// So StringSearch will not be able to find them.
-bool hasNoWeightChar(icu_64_64::Collator const& collator,
-                     icu_64_64::UnicodeString const& unicodeStr) {
-  icu_64_64::UnicodeString const empty;
-  for (int32_t i = 0; i < unicodeStr.length();
-       i = unicodeStr.moveIndex32(i, 1)) {
-    UErrorCode status = U_ZERO_ERROR;
-    if (collator.compare(icu_64_64::UnicodeString(unicodeStr.char32At(i)),
-                         empty, status) == UCOL_EQUAL) {
-      return true;
-    }
-  }
-  return false;
-}
-
 }  // namespace
 
 /// @brief function TO_STRING
@@ -282,15 +266,6 @@ AqlValue functions::FindFirst(ExpressionContext* expressionContext,
   UErrorCode status = U_ZERO_ERROR;
   icu_64_64::StringSearch search(uSearchBuf, uBuf, locale, nullptr, status);
 
-  if (U_SUCCESS(status) && hasNoWeightChar(*search.getCollator(), uSearchBuf)) {
-    int32_t start =
-        static_cast<int32_t>(std::min<int64_t>(startOffset, uBuf.length()));
-    int32_t end =
-        static_cast<int32_t>(std::min<int64_t>(maxEnd + 1, uBuf.length()));
-    return AqlValue(
-        AqlValueHintInt(uBuf.indexOf(uSearchBuf, start, end - start)));
-  }
-
   for (int pos = search.first(status); U_SUCCESS(status) && pos != USEARCH_DONE;
        pos = search.next(status)) {
     if (U_FAILURE(status)) {
@@ -369,15 +344,6 @@ AqlValue functions::FindLast(ExpressionContext* expressionContext,
   UErrorCode status = U_ZERO_ERROR;
   icu_64_64::StringSearch search(uSearchBuf, uBuf, locale, nullptr, status);
 
-  if (U_SUCCESS(status) && hasNoWeightChar(*search.getCollator(), uSearchBuf)) {
-    int32_t start =
-        static_cast<int32_t>(std::min<int64_t>(startOffset, uBuf.length()));
-    int32_t end =
-        static_cast<int32_t>(std::min<int64_t>(maxEnd + 1, uBuf.length()));
-    return AqlValue(
-        AqlValueHintInt(uBuf.lastIndexOf(uSearchBuf, start, end - start)));
-  }
-
   int foundPos = -1;
   for (int pos = search.first(status); U_SUCCESS(status) && pos != USEARCH_DONE;
        pos = search.next(status)) {
```

**File**: `tests/js/client/aql/aql-functions-string.js` (modified, +4/-29)
```diff
@@ -1756,18 +1756,7 @@ function ahuacatlStringFunctionsTestSuite () {
       [ 4, 'foo bar foo bar', 'bar' ],
       [ 17, 'Heavy metal from MÖtleyCrÜe or MÖtleyCrÜe doing heavy metal?', 'MÖtleyCrÜe'],
       [ 3, '或或或MÖtleyCrÜe或MÖtleyCrÜe从重金属中提取重金属？',  'MÖtleyCrÜe'],
-      [ 10, 'MÖtleyCrÜe或MÖtleyCrÜe从重金属中提取重金属？',  '或'],
-      [ 0, 'カエルの子はカエル', 'カエル'],
-      [ 1, 'a\bb', '\b' ],
-      [ 1, 'a\u0000b', '\u0000' ],
-      [ 1, 'a\u0001b', '\u0001' ],
-      [ 1, 'a\u001fb', '\u001f' ],
-      [ 1, 'a\u007fb', '\u007f' ],
-      [ 1, 'a\bb\b', '\bb' ],
-      [ 0, 'a\bb', 'a\b' ],
-      [ 0, 'a\bb', 'a\bb' ],
-      [ 1, 'a\b\u0001b', '\b\u0001' ],
-      [ -1, 'a\bb', '\b\u0001' ]
+      [ 10, 'MÖtleyCrÜe或MÖtleyCrÜe从重金属中提取重金属？',  '或']
     ].forEach(function (v) {
       var actual = getQueryResults(`RETURN FIND_FIRST(` + JSON.stringify(v[1]) + ', ' + JSON.stringify(v[2]) + ')');
       assertEqual([ v[0] ], actual);
@@ -1795,10 +1784,7 @@ function ahuacatlStringFunctionsTestSuite () {
       [ 4, 'the quick brown bar jumped over the lazy dog', 'q', 1 ],
       [ 4, 'the quick brown bar jumped over the lazy dog', 'q', 3 ],
       [ 4, 'the quick brown bar jumped over the lazy dog', 'q', 4 ],
-      [ -1, 'the quick brown bar jumped over the lazy dog', 'q', 5 ],
-      [ 1, 'a\bb', '\b', 0, 1 ],
-      [ 3, 'a\bb\b', '\b', 2 ],
-      [ -1, 'a\bb\b', '\b', 2, 2 ]
+      [ -1, 'the quick brown bar jumped over the lazy dog', 'q', 5 ]
     ].forEach(function (v) {
       var actual = getQueryResults(`RETURN FIND_FIRST(` + JSON.stringify(v[1]) + ', ' + JSON.stringify(v[2]) + ', ' + v[3] + ', ' + (v[4] === undefined ? null : v[4]) + ')');
       assertEqual([ v[0] ], actual);
@@ -1886,15 +1872,7 @@ function ahuacatlStringFunctionsTestSuite () {
       [ 14, 'some linebreak\r\ngoes here', '\r\n' ],
       [ 31, 'Heavy metal from MÖtleyCrÜe or MÖtleyCrÜe doing heavy metal?', 'MÖtleyCrÜe'],
       [ 11, 'MÖtleyCrÜe或MÖtleyCrÜe从重金属中提取重金属？',  'MÖtleyCrÜe'],
-      [ 10, 'MÖtleyCrÜe或MÖtleyCrÜe从重金属中提取重金属？',  '或'],
-      [ 6, 'カエルの子はカエル', 'カエル'],
-      [ 3, 'a\bb\b', '\b' ],
-      [ 1, 'a\bb\b', '\bb' ],
-      [ 0, 'a\bb', 'a\bb' ],
-      [ 3, 'a\u0000b\u0000', '\u0000' ],
-      [ 3, 'a\u0001b\u0001', '\u0001' ],
-      [ 3, 'a\u001fb\u001f', '\u001f' ]
-
+      [ 10, 'MÖtleyCrÜe或MÖtleyCrÜe从重金属中提取重金属？',  '或']
     ].forEach(function (v) {
       var actual = getQueryResults(`RETURN FIND_LAST(` + JSON.stringify(v[1]) + ', ' + JSON.stringify(v[2]) + ')');
       assertEqual([ v[0] ], actual);
@@ -1923,10 +1901,7 @@ function ahuacatlStringFunctionsTestSuite () {
       [ 3, 'foobar', 'bar', 0, 999 ],
       [ 32, 'the quick brown bar jumped over the lazy dog', 'the', 0 ],
       [ 32, 'the quick brown bar jumped over the lazy dog', 'the', 10 ],
-      [ 32, 'the quick brown bar jumped over the lazy dog', 'the', 1 ],
-      [ 1, 'a\bb\b', '\b', 0, 2 ],
-      [ 3, 'a\bb\b', '\b', 1 ],
-      [ -1, 'a\bb\b', '\b', 2, 2 ]
+      [ 32, 'the quick brown bar jumped over the lazy dog', 'the', 1 ]
     ].forEach(function (v) {
       var actual = getQueryResults(`RETURN FIND_LAST(` + JSON.stringify(v[1]) + ', ' + JSON.stringify(v[2]) + ', ' + v[3] + ', ' + (v[4] === undefined ? null : v[4]) + ')');
       assertEqual([ v[0] ], actual);
```

---

### Incident Patch 10: `b2947b15` (2026-10-02)
**Commit Message**: Update node modules: brace-expansion to 5.0.12, fast-uri to 3.1.8 (#23407)

**File**: `CHANGELOG` (modified, +6/-0)
```diff
@@ -1,5 +1,11 @@
 3.12.13 (XXXX-XX-XX)
 --------------------
+
+* Updated node modules:
+ - brace-expansion to 5.0.12 to resolve CVE-2026-102276, CVE-2026-102277
+   and CVE-2026-102278
+ - fast-uri to 3.1.8 to resolve CVE-2026-86472
+
 * COR-1012 The client tools started with `--server.username`/`--server.password`
   now obtain a JWT via `POST /_open/auth` like arangosh and renew it before
   it expires, which also makes them work against servers in RBAC mode; they
```

**File**: `LICENSES-OTHER-COMPONENTS.md` (modified, +2/-2)
```diff
@@ -1102,7 +1102,7 @@ License Id: -
 #### brace-expansion
 
 * Name: brace-expansion
-* Version: 5.0.9
+* Version: 5.0.12
 * Project Home: <https://github.com/juliangruber/brace-expansion>
 * License: <https://raw.githubusercontent.com/juliangruber/brace-expansion/main/LICENSE>
 * License Name: MIT License
@@ -1281,7 +1281,7 @@ License Id: -
 #### fast-uri
 
 * Name: fast-uri
-* Version: 3.1.7
+* Version: 3.1.8
 * Project Home: <https://github.com/fastify/fast-uri>
 * License: <https://raw.githubusercontent.com/fastify/fast-uri/main/LICENSE>
 * License Name: BSD-style 3-Clause License
```

**File**: `js/node/node_modules/brace-expansion/dist/commonjs/index.js` (modified, +69/-25)
```diff
@@ -1,6 +1,6 @@
 "use strict";
 Object.defineProperty(exports, "__esModule", { value: true });
-exports.EXPANSION_MAX_LENGTH = exports.EXPANSION_MAX = void 0;
+exports.EXPANSION_MAX_REWRITES = exports.EXPANSION_MAX_DEPTH = exports.EXPANSION_MAX_LENGTH = exports.EXPANSION_MAX = void 0;
 exports.expand = expand;
 const balanced_match_1 = require("balanced-match");
 const escSlash = '\0SLASH' + Math.random() + '\0';
@@ -30,6 +30,24 @@ exports.EXPANSION_MAX = 100_000;
 // realistic expansion (100k results hitting `EXPANSION_MAX` measure ~1M
 // characters) so legitimate input is unaffected.
 exports.EXPANSION_MAX_LENGTH = 4_000_000;
+// `expand_` recurses once per level of brace *nesting* - both when expanding a
+// set's comma members and when re-wrapping a set whose body is a single part.
+// The CVE-2026-14257 fix made the *tail* iterative (recursion on `m.post`, one
+// level per chained group), which left nesting depth unbounded: about 3,100
+// levels of `{{{...a,b...}}}` - only ~6KB of input - exhausted the native stack
+// and crashed the process. `EXPANSION_MAX_DEPTH` bounds how deep the parser
+// will follow nesting. It sits far above any realistic pattern and well below
+// the depth at which the stack runs out.
+exports.EXPANSION_MAX_DEPTH = 1_000;
+// Bash keeps a quirk where a brace group followed by a comma set still expands
+// (`{a},b}`). The parser implements it by rewriting the string and restarting
+// the scan, absorbing one `}` per pass. `n` trailing braces therefore cost `n`
+// full passes over a string that itself grows by one `escClose` sentinel each
+// time - quadratic in `n`, with a ~26x constant from the sentinel's length.
+// 128KB of `'{a}' + '}'.repeat(n) + ',z}'` blocked the event loop for 27
+// seconds to produce two results. `EXPANSION_MAX_REWRITES` bounds how many
+// times the scan may restart. Real `{a},b}` input needs a handful.
+exports.EXPANSION_MAX_REWRITES = 1_000;
 function numeric(str) {
     return !isNaN(str) ? parseInt(str, 10) : str.charCodeAt(0);
 }
@@ -49,37 +67,52 @@ function unescapeBraces(str) {
         .replace(escCommaPattern, ',')
         .replace(escPeriodPattern, '.');
 }
+// Like `target.push(...items)` but doesn't overflow the stack
+function pushAll(target, items) {
+    for (let i = 0; i < items.length; i++) {
+        target.push(items[i]);
+    }
+}
 /**
  * Basically just str.split(","), but handling cases
  * where we have nested braced sections, which should be
  * treated as individual members, like {a,{b,c},d}
  */
 function parseCommaParts(str) {
-    if (!str) {
-        return [''];
-    }
     const parts = [];
-    const m = (0, balanced_match_1.balanced)('{', '}', str);
-    if (!m) {
-        return str.split(',');
-    }
-    const { pre, body, post } = m;
-    const p = pre.split(',');
-    p[p.length - 1] += '{' + body + '}';
-    const postParts = parseCommaParts(post);
-    if (post.length) {
-        ;
-        p[p.length - 1] += postParts.shift();
-        p.push.apply(p, postParts);
+    // Walk the brace groups iteratively. Recursing on `post` once per group let a
+    // chain of them exhaust the stack - the parsing-side counterpart to
+    // the `expand_` overflow fixed for CVE-2026-14257, and not something `max` or
+    // `maxLength` can bound, since it happens before expansion.
+    //
+    // The part the next chunk continues
+    let carry = '';
+    for (;;) {
+        const m = (0, balanced_match_1.balanced)('{', '}', str);
+        if (!m) {
+            const tail = str.split(',');
+            tail[0] = carry + tail[0];
+            pushAll(parts, tail);
+            return parts;
+        }
+        const { pre, body, post } = m;
+        const p = pre.split(',');
+        p[0] = carry + p[0];
+        p[p.length - 1] += '{' + body + '}';
+        if (!post.length) {
+            pushAll(parts, p);
+            return parts;
+        }
+        carry = p.pop();
+        pushAll(parts, p);
+        str = post;
     }
-    parts.push.apply(parts, p);
-    return parts;
 }
 function expand(str, options = {}) {
     if (!str) {
         return [];
     }
-    const { max = exports.EXPANSION_MAX, maxLength = exports.EXPANSION_MAX_LENGTH } = options;
+    const { max = exports.EXPANSION_MAX, maxLength = exports.EXPANSION_MAX_LENGTH, maxDepth = exports.EXPANSION_MAX_DEPTH, maxRewrites = exports.EXPANSION_MAX_REWRITES, } = options;
     // I don't know why Bash 4.3 does this, but it does.
     // Anything starting with {} will have the first two bytes preserved
     // but *only* at the top level, so {},a}b will not expand to anything,
@@ -89,7 +122,7 @@ function expand(str, options = {}) {
     if (str.slice(0, 2) === '{}') {
         str = '\\{\\}' + str.slice(2);
     }
-    return expand_(escapeBraces(str), max, maxLength, true).map(unescapeBraces);
+    return expand_(escapeBraces(str), max, maxLength, maxDepth, 0, maxRewrites, true).map(unescapeBraces);
 }
 function embrace(str) {
     return '{' + str + '}';

```

**File**: `js/node/node_modules/brace-expansion/dist/esm/index.js` (modified, +68/-24)
```diff
@@ -26,6 +26,24 @@ export const EXPANSION_MAX = 100_000;
 // realistic expansion (100k results hitting `EXPANSION_MAX` measure ~1M
 // characters) so legitimate input is unaffected.
 export const EXPANSION_MAX_LENGTH = 4_000_000;
+// `expand_` recurses once per level of brace *nesting* - both when expanding a
+// set's comma members and when re-wrapping a set whose body is a single part.
+// The CVE-2026-14257 fix made the *tail* iterative (recursion on `m.post`, one
+// level per chained group), which left nesting depth unbounded: about 3,100
+// levels of `{{{...a,b...}}}` - only ~6KB of input - exhausted the native stack
+// and crashed the process. `EXPANSION_MAX_DEPTH` bounds how deep the parser
+// will follow nesting. It sits far above any realistic pattern and well below
+// the depth at which the stack runs out.
+export const EXPANSION_MAX_DEPTH = 1_000;
+// Bash keeps a quirk where a brace group followed by a comma set still expands
+// (`{a},b}`). The parser implements it by rewriting the string and restarting
+// the scan, absorbing one `}` per pass. `n` trailing braces therefore cost `n`
+// full passes over a string that itself grows by one `escClose` sentinel each
+// time - quadratic in `n`, with a ~26x constant from the sentinel's length.
+// 128KB of `'{a}' + '}'.repeat(n) + ',z}'` blocked the event loop for 27
+// seconds to produce two results. `EXPANSION_MAX_REWRITES` bounds how many
+// times the scan may restart. Real `{a},b}` input needs a handful.
+export const EXPANSION_MAX_REWRITES = 1_000;
 function numeric(str) {
     return !isNaN(str) ? parseInt(str, 10) : str.charCodeAt(0);
 }
@@ -45,37 +63,52 @@ function unescapeBraces(str) {
         .replace(escCommaPattern, ',')
         .replace(escPeriodPattern, '.');
 }
+// Like `target.push(...items)` but doesn't overflow the stack
+function pushAll(target, items) {
+    for (let i = 0; i < items.length; i++) {
+        target.push(items[i]);
+    }
+}
 /**
  * Basically just str.split(","), but handling cases
  * where we have nested braced sections, which should be
  * treated as individual members, like {a,{b,c},d}
  */
 function parseCommaParts(str) {
-    if (!str) {
-        return [''];
-    }
     const parts = [];
-    const m = balanced('{', '}', str);
-    if (!m) {
-        return str.split(',');
-    }
-    const { pre, body, post } = m;
-    const p = pre.split(',');
-    p[p.length - 1] += '{' + body + '}';
-    const postParts = parseCommaParts(post);
-    if (post.length) {
-        ;
-        p[p.length - 1] += postParts.shift();
-        p.push.apply(p, postParts);
+    // Walk the brace groups iteratively. Recursing on `post` once per group let a
+    // chain of them exhaust the stack - the parsing-side counterpart to
+    // the `expand_` overflow fixed for CVE-2026-14257, and not something `max` or
+    // `maxLength` can bound, since it happens before expansion.
+    //
+    // The part the next chunk continues
+    let carry = '';
+    for (;;) {
+        const m = balanced('{', '}', str);
+        if (!m) {
+            const tail = str.split(',');
+            tail[0] = carry + tail[0];
+            pushAll(parts, tail);
+            return parts;
+        }
+        const { pre, body, post } = m;
+        const p = pre.split(',');
+        p[0] = carry + p[0];
+        p[p.length - 1] += '{' + body + '}';
+        if (!post.length) {
+            pushAll(parts, p);
+            return parts;
+        }
+        carry = p.pop();
+        pushAll(parts, p);
+        str = post;
     }
-    parts.push.apply(parts, p);
-    return parts;
 }
 export function expand(str, options = {}) {
     if (!str) {
         return [];
     }
-    const { max = EXPANSION_MAX, maxLength = EXPANSION_MAX_LENGTH } = options;
+    const { max = EXPANSION_MAX, maxLength = EXPANSION_MAX_LENGTH, maxDepth = EXPANSION_MAX_DEPTH, maxRewrites = EXPANSION_MAX_REWRITES, } = options;
     // I don't know why Bash 4.3 does this, but it does.
     // Anything starting with {} will have the first two bytes preserved
     // but *only* at the top level, so {},a}b will not expand to anything,
@@ -85,7 +118,7 @@ export function expand(str, options = {}) {
     if (str.slice(0, 2) === '{}') {
         str = '\\{\\}' + str.slice(2);
     }
-    return expand_(escapeBraces(str), max, maxLength, true).map(unescapeBraces);
+    return expand_(escapeBraces(str), max, maxLength, maxDepth, 0, maxRewrites, true).map(unescapeBraces);
 }
 function embrace(str) {
     return '{' + str + '}';
@@ -180,7 +213,13 @@ function expandSequence(body, isAlphaSequence, max, maxLength) {
     }
     return N;
 }
-function expand_(str, max, maxLength, isTop) {
+function expand_(str, max, maxLength, maxDepth, depth, maxRewrites, isTop) {
+    // Too deeply nested to keep following: treat the rest as literal, the same
+    // way a group that cannot expand is already handled. Truncating rather than
+    // throwing keeps `expand` total, matching `max` and `maxLength`.
+   
```

**File**: `js/node/node_modules/brace-expansion/package.json` (modified, +2/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "brace-expansion",
   "description": "Brace expansion as known from sh/bash",
-  "version": "5.0.9",
+  "version": "5.0.12",
   "files": [
     "dist"
   ],
@@ -29,6 +29,7 @@
     "test": "tap",
     "snap": "tap",
     "format": "prettier --write .",
+    "format:check": "prettier --check .",
     "benchmark": "node benchmark/index.js",
     "typedoc": "typedoc --tsconfig .tshy/esm.json ./src/*.ts"
   },
```

**File**: `js/node/node_modules/fast-uri/index.js` (modified, +10/-6)
```diff
@@ -526,13 +526,17 @@ function parseWithStatus (uri, opts) {
       malformedHost = canonicalizeHost(parsed, options, schemeHandler, isIP)
     }
 
-    if (!schemeHandler || (schemeHandler && !schemeHandler.skipNormalize)) {
-      if (uri.indexOf('%') !== -1) {
-        if (parsed.host !== undefined && !malformedIPLiteral) {
-          const host = isIP ? parsed.host : normalizePercentEncoding(parsed.host, true)
-          parsed.host = reescapeHostDelimiters(host, isIP)
-        }
+    if (uri.indexOf('%') !== -1 && parsed.host !== undefined && !malformedIPLiteral) {
+      let host = isIP ? parsed.host : normalizePercentEncoding(parsed.host, true)
+      if (!isIP) {
+        // Fold reg-name case after decoding unreserved octets. The second
+        // pass only restores uppercase hex in escapes that remain encoded.
+        host = normalizePercentEncoding(host.toLowerCase())
       }
+      parsed.host = reescapeHostDelimiters(host, isIP)
+    }
+
+    if (!schemeHandler || (schemeHandler && !schemeHandler.skipNormalize)) {
       if (parsed.path) {
         parsed.path = normalizePathEncoding(parsed.path)
       }
```

**File**: `js/node/node_modules/fast-uri/package.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "fast-uri",
   "description": "Dependency-free RFC 3986 URI toolbox",
-  "version": "3.1.7",
+  "version": "3.1.8",
   "main": "index.js",
   "type": "commonjs",
   "types": "types/index.d.ts",
```

**File**: `js/node/package-lock.json` (modified, +8/-8)
```diff
@@ -11,15 +11,15 @@
         "ansi-html-community": "^0.0.8",
         "aqb": "^2.1.0",
         "babel-code-frame": "^6.26.0",
-        "brace-expansion": "^5.0.9",
+        "brace-expansion": "^5.0.12",
         "chai": "^3.5.0",
         "content-disposition": "^0.5.4",
         "content-type": "^1.0.5",
         "dedent": "^0.7.0",
         "diff": "^8.0.3",
         "error-stack-parser": "^2.1.4",
         "extendible": "^0.1.1",
-        "fast-uri": "^3.1.7",
+        "fast-uri": "^3.1.8",
         "graphql-sync": "^0.6.2-sync",
         "highlight.js": "^10.7.3",
         "http-errors": "^1.8.0",
@@ -222,9 +222,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
@@ -442,9 +442,9 @@
       "license": "MIT"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.7",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz",
-      "integrity": "sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==",
+      "version": "3.1.8",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.8.tgz",
+      "integrity": "sha512-GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg==",
       "funding": [
         {
           "type": "github",
```

---

### Incident Patch 11: `cd0f5926` (2026-10-01)
**Commit Message**: Merge pull request #23354 from arangodb/bug-fix/COR-1040-confusing-error-in-UI-when-creating-indexes

[COR-1040] Fix confusing error message in the web UI when creating indexes.

**File**: `CHANGELOG` (modified, +5/-0)
```diff
@@ -32,6 +32,11 @@
   null with a warning; it now matches at every character position, e.g.
   SUBSTITUTE('abc', '', '_') returns '_a_b_c_'.
 
+* COR-1040: Fix the web UI repeatedly reporting "Something went wrong while
+  creating the index : not found" after saving an arangosearch view link or
+  creating an index, accompanied by "not allowed to connect to this URL" in
+  the server log.
+
 * COR-994: arangodump, arangorestore and arangosh now renew a JWT passed via
   `--server.jwt-token` before it expires, using `POST /_open/auth/renew`
   and controlled by `--server.jwt-renewal-threshold`. Long-running dumps
```

**File**: `js/apps/system/_admin/aardvark/APP/aardvark.js` (modified, +8/-35)
```diff
@@ -36,7 +36,6 @@ const createRouter = require('@arangodb/foxx/router');
 const users = require('@arangodb/users');
 const cluster = require('@arangodb/cluster');
 const generalGraph = require('@arangodb/general-graph');
-const request = require('@arangodb/request');
 const isEnterprise = require('internal').isEnterprise();
 const explainer = require('@arangodb/aql/explainer');
 const fs = require('fs');
@@ -364,57 +363,31 @@ authRouter.post('/job', function (req, res) {
   Create a new job id entry in a specific system database with a given id.
 `);
 
+// the results of the referenced jobs are collected by the browser before it
+// calls this route. the service must not fetch them itself, because a
+// server-side request back into this very server is rejected by the JavaScript
+// endpoint allowlist.
 authRouter.delete('/job', function (req, res) {
-  let arr = [];
   let frontend = db._collection('_frontend');
 
   if (frontend) {
-    // get all job results and return before deletion
-    _.each(frontend.all().toArray(), function (job) {
-      let resp = request.put({
-        url: '/_api/job/' + encodeURIComponent(job.id),
-        json: true,
-        headers: {
-          'Authorization': req.headers.authorization
-        }
-      }).body;
-      try {
-        arr.push(JSON.parse(resp));
-      } catch (ignore) {
-      }
-    });
-
-    // actual deletion
     frontend.removeByExample({model: 'job'}, false);
   }
-  res.json({result: arr});
+  res.json(true);
 })
 .summary('Delete all jobs')
 .description(dd`
   Delete all jobs in a specific system database with a given id.
 `);
 
+// see the note on 'delete /job' above: fetching the job result is the browser's
+// responsibility.
 authRouter.delete('/job/:id', function (req, res) {
   let frontend = db._collection('_frontend');
-  let toReturn = {};
   if (frontend) {
-    // get the job result and return before deletion
-    let resp = request.put({
-      url: '/_db/' + encodeURIComponent(db._name()) + '/_api/job/' + encodeURIComponent(req.pathParams.id),
-      json: true,
-      headers: {
-        'Authorization': req.headers.authorization
-      }
-    }).body;
-    try {
-      toReturn = JSON.parse(resp);
-    } catch (ignore) {
-    }
-
-    // actual deletion
     frontend.removeByExample({id: req.pathParams.id}, false);
   }
-  res.json(toReturn);
+  res.json(true);
 })
 .summary('Delete a job id')
 .description(dd`
```

**File**: `js/apps/system/_admin/aardvark/APP/frontend/js/arango/arango.js` (modified, +76/-51)
```diff
@@ -748,67 +748,92 @@
       });
     },
 
+    // fetching the result of a finished job is what removes that job on the
+    // server. it has to be issued from the browser: the aardvark Foxx service
+    // may not call back into its own server, because the JavaScript endpoint
+    // allowlist rejects such requests.
+    fetchJobResult: function (id) {
+      return new Promise((resolve) => {
+        $.ajax({
+          cache: false,
+          type: 'PUT',
+          url: this.databaseUrl('/_api/job/' + encodeURIComponent(id)),
+          contentType: 'application/json',
+          processData: false,
+          complete: (xhr) => resolve(xhr.responseJSON)
+        });
+      });
+    },
+
+    reportJobError: function (jobResult) {
+      // a job that is not there anymore is intentionally not considered an error
+      // here. this is because in some other places we collect job data, which
+      // automatically leads to server-side deletion of the job. so just swallow
+      // 404 errors here, silently...
+      if (!jobResult || !jobResult.error || jobResult.errorNum === 404) {
+        return;
+      }
+      if (jobResult.errorNum && jobResult.errorMessage) {
+        arangoHelper.arangoError(`Error ${jobResult.errorNum}`, jobResult.errorMessage);
+      } else {
+        arangoHelper.arangoError('Failure', 'Got unexpected server response: ' + JSON.stringify(jobResult));
+      }
+    },
+
     deleteAardvarkJob: function (id, callback) {
-      $.ajax({
-        cache: false,
-        type: 'DELETE',
-        url: this.databaseUrl('/_admin/aardvark/job/' + encodeURIComponent(id)),
-        contentType: 'application/json',
-        processData: false,
-        success: function (data) {
-          // deleting a job that is not there anymore is intentionally not considered
-          // an error here. this is because in some other places we collect job data,
-          // which automatically leads to server-side deletion of the job. so just
-          // swallow 404 errors here, silently...
-          if (data && data.error && data.errorNum !== 404) {
-            if (data.errorNum && data.errorMessage) {
-              arangoHelper.arangoError(`Error ${data.errorNum}`, data.errorMessage);
-            } else {
-              arangoHelper.arangoError('Failure', 'Got unexpected server response: ' + JSON.stringify(data));
+      this.fetchJobResult(id).then((jobResult) => {
+        this.reportJobError(jobResult);
+        $.ajax({
+          cache: false,
+          type: 'DELETE',
+          url: this.databaseUrl('/_admin/aardvark/job/' + encodeURIComponent(id)),
+          contentType: 'application/json',
+          processData: false,
+          success: (data) => {
+            if (callback) {
+              callback(false, data);
+            }
+          },
+          error: (data) => {
+            if (callback) {
+              callback(true, data);
             }
-            return;
-          }
-          if (callback) {
-            callback(false, data);
-          }
-        },
-        error: function (data) {
-          if (callback) {
-            callback(true, data);
           }
-        }
+        });
       });
     },
 
     deleteAllAardvarkJobs: function (callback) {
-      $.ajax({
-        cache: false,
-        type: 'DELETE',
-        url: this.databaseUrl('/_admin/aardvark/job'),
-        contentType: 'application/json',
-        processData: false,
-        success: function (data) {
-          if (data.result && data.result.length > 0) {
-            _.each(data.result, function (resp) {
-              if (resp.error) {
-                if (resp.errorNum && resp.errorMessage) {
-                  arangoHelper.arangoError(`Error ${resp.errorNum}`, resp.errorMessage);
-                } else {
-                  arangoHelper.arangoError('Failure', 'Got unexpected server response: ' + JSON.stringify(resp));
-                }
-                return;
-              }
-            });
-          }
-          if (callback) {
-            callback(false, data);
-          }
-        },
-        error: function (data) {
+      this.getAardvarkJobs((error, jobs) => {
+        if (error) {
           if (callback) {
-            callback(true, data);
+            callback(true, jobs);
           }
+          return;
         }
+
+        const pending = jobs.map((job) =>
+          this.fetchJobResult(job.id).then((jobResult) => this.reportJobError(jobResult)));
+
+        Promise.all(pending).then(() => {
+          $.ajax({
+            cache: false,
+            type: 'DELETE',
+            url: this.databaseUrl('/_admin/aardvark/job'),
+            contentType: 'application/json',
+            processData: false,
+            success: (data) => {
+              if (callback) {
+                callback(false, data);
+              }
+            },
+            error: (data) => {
+              if (callback) {
+                callback(true, data);
+              }
+  
```

---

### Incident Patch 12: `82ac2e43` (2026-10-01)
**Commit Message**: Merge pull request #23390 from arangodb/bug-fix/cor-883-update-velocypack

[COR-883] Update velocypack

**File**: `3rdParty/velocypack` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit bfd737ade8583fbddbd61ebfcb848a3e02ed71d6
+Subproject commit 1450560e980140578eb050199f58c4351a5d13d5
```

---

### Incident Patch 13: `77b99fe2` (2026-09-30)
**Commit Message**: Fix changelog

**File**: `CHANGELOG` (modified, +5/-5)
```diff
@@ -1,5 +1,10 @@
 3.12.13 (XXXX-XX-XX)
 --------------------
+* COR-1012 The client tools started with `--server.username`/`--server.password`
+  now obtain a JWT via `POST /_open/auth` like arangosh and renew it before
+  it expires, which also makes them work against servers in RBAC mode; they
+  fall back to HTTP basic authentication if the server issues no token.
+
 * COR-1018: Cap vector index search result buffers at the collection's
   document count and track their memory against the query memory limit.
 
@@ -68,11 +73,6 @@
   Fix remote SmartGraph edge modifications so returnNew/returnOld response data
   is not persisted in the _to shadow collection.
 
-* COR-1012 The client tools started with `--server.username`/`--server.password`
-  now obtain a JWT via `POST /_open/auth` like arangosh and renew it before
-  it expires, which also makes them work against servers in RBAC mode; they
-  fall back to HTTP basic authentication if the server issues no token.
-
 * arangodump, arangorestore and arangobackup now report the server's error (e.g.
   "HTTP 401 (Unauthorized): ArangoError 11: User not authenticated") together
   with the "Could not connect to endpoint" message when the initial connection
```

---

### Incident Patch 14: `e5c00eb2` (2026-09-29)
**Commit Message**: Merge pull request #23353 from arangodb/bug-fix/substitute-on-empty-replacement

Fix `SUBSTITUTE` when using empty replacement

**File**: `CHANGELOG` (modified, +4/-0)
```diff
@@ -16,6 +16,10 @@
 
 * Updated ArangoDB Starter to v0.19.28.
 
+* Fix AQL SUBSTITUTE() with an empty search string. It previously returned
+  null with a warning; it now matches at every character position, e.g.
+  SUBSTITUTE('abc', '', '_') returns '_a_b_c_'.
+
 * COR-994: arangodump, arangorestore and arangosh now renew a JWT passed via
   `--server.jwt-token` before it expires, using `POST /_open/auth/renew`
   and controlled by `--server.jwt-renewal-threshold`. Long-running dumps
```

**File**: `arangod/Aql/Function/StringFunctions.cpp` (modified, +55/-98)
```diff
@@ -52,6 +52,7 @@
 #include <unicode/uchar.h>
 #include <unicode/unistr.h>
 
+#include <algorithm>
 #include <cstdint>
 #include <cstring>
 #include <string_view>
@@ -772,21 +773,21 @@ AqlValue functions::Substitute(ExpressionContext* expressionContext,
   velocypack::StringSink adapter(buffer.get());
 
   appendAsString(vopts, adapter, value);
-  if (buffer->empty()) {
-    // ICU's StringSearch rejects an empty text with U_ILLEGAL_ARGUMENT_ERROR
-    return AqlValue(*buffer);
-  }
   icu_64_64::UnicodeString unicodeStr(buffer->data(),
                                       static_cast<int32_t>(buffer->length()));
 
   auto& server = trx->vocbase().server();
   auto locale = server.getFeature<LanguageFeature>().getLocale();
-  // we can't copy the search instances, thus use pointers:
+  // we can't copy the search instances, thus use pointers.
+  // ICU's StringSearch rejects empty patterns and texts
   std::vector<std::unique_ptr<icu_64_64::StringSearch>> searchVec;
   searchVec.reserve(matchPatterns.size());
   UErrorCode status = U_ZERO_ERROR;
   for (auto const& searchStr : matchPatterns) {
-    // create a vector of string searches
+    if (searchStr.isEmpty() || unicodeStr.isEmpty()) {
+      searchVec.push_back(nullptr);
+      continue;
+    }
     searchVec.push_back(std::make_unique<icu_64_64::StringSearch>(
         searchStr, unicodeStr, locale, nullptr, status));
     if (U_FAILURE(status)) {
@@ -795,118 +796,74 @@ AqlValue functions::Substitute(ExpressionContext* expressionContext,
     }
   }
 
-  std::vector<std::pair<int32_t, int32_t>> srchResultPtrs;
+  // pair of the position and length of the found match
+  using Match = std::pair<int32_t, int32_t>;
+  auto const fromSearch = [&](size_t which, int32_t pos) -> Match {
+    if (pos == USEARCH_DONE) {
+      return {pos, 0};
+    }
+    return {pos, searchVec[which]->getMatchedLength()};
+  };
+  auto const firstMatch = [&](size_t which) -> Match {
+    if (searchVec[which] == nullptr) {
+      return {matchPatterns[which].isEmpty() ? 0 : USEARCH_DONE, 0};
+    }
+    return fromSearch(which, searchVec[which]->first(status));
+  };
+  auto const nextMatch = [&](size_t which, int32_t pos) -> Match {
+    if (searchVec[which] == nullptr) {
+      return {pos < unicodeStr.length() ? unicodeStr.moveIndex32(pos, 1)
+                                        : USEARCH_DONE,
+              0};
+    }
+    return fromSearch(which, searchVec[which]->next(status));
+  };
+
+  std::vector<Match> srchResultPtrs;
   std::string utf8;
   srchResultPtrs.reserve(matchPatterns.size());
-  for (auto& search : searchVec) {
+  for (size_t i = 0; i < matchPatterns.size(); ++i) {
     // We now find the first hit for each search string.
-    auto pos = search->first(status);
+    srchResultPtrs.push_back(firstMatch(i));
     if (U_FAILURE(status)) {
       registerICUWarning(expressionContext, AFN, status);
       return AqlValue(AqlValueHintNull());
     }
-
-    int32_t len = 0;
-    if (pos != USEARCH_DONE) {
-      len = search->getMatchedLength();
-    }
-    srchResultPtrs.push_back(std::make_pair(pos, len));
   }
 
   icu_64_64::UnicodeString result;
   int32_t lastStart = 0;
-  int64_t count = 0;
-  while (true) {
-    int which = -1;
-    int32_t pos = USEARCH_DONE;
-    int32_t mLen = 0;
-    int i = 0;
-    for (auto resultPair : srchResultPtrs) {
-      // We locate the nearest matching search result.
-      int32_t thisPos;
-      thisPos = resultPair.first;
-      if ((pos == USEARCH_DONE) || (pos > thisPos)) {
-        if (thisPos != USEARCH_DONE) {
-          pos = thisPos;
-          which = i;
-          mLen = resultPair.second;
-        }
-      }
-      i++;
-    }
-    if (which == -1) {
+  for (int64_t count = 0; limit == -1 || count < limit; ++count) {
+    auto best = std::ranges::min_element(
+        srchResultPtrs, [](Match const& a, Match const& b) {
+          return a.first != USEARCH_DONE &&
+                 (b.first == USEARCH_DONE || a.first < b.first);
+        });
+    if (best->first == USEARCH_DONE) {
       break;
     }
-    // from last match to this match, copy the original string.
+    size_t const which = best - srchResultPtrs.begin();
+    auto const [pos, len] = *best;
+
     result.append(unicodeStr, lastStart, pos - lastStart);
-    if (replacePatterns.size() != 0) {
-      if (replacePatterns.size() > (size_t)which) {
-        result.append(replacePatterns[which]);
-      } else if (replaceWasPlainString) {
-        result.append(replacePatterns[0]);
-      }
+    if (which < replacePatterns.size()) {
+      result.append(replacePatterns[which]);
+    } else if (replaceWasPlainString) {
+      result.append(replacePatterns[0]);
     }
+    lastStart = pos + len;
 
-    // lastStart is the place up to we searched the source string
-    lastStart = pos + mLen;
-
-    // we try to search the next occurance of this string
-    auto& search = searchVec[which];
-    pos = search->next(status);
+    srchResultPtrs[which]
```

**File**: `tests/js/client/aql/aql-functions-string.js` (modified, +12/-0)
```diff
@@ -1344,6 +1344,14 @@ function ahuacatlStringFunctionsTestSuite () {
         [ '', '', [ 'foo', 'baz' ], [ 'bar', 'qux' ] ],
         [ '', '', { foo: 'bar' } ],
         [ '', '', 'foo', 'bar', 1 ],
+        [ '_a_b_c_', 'abc', '', '_' ],
+        [ '_a_bc', 'abc', '', '_', 2 ],
+        [ '_a_b_c_', 'abc', [ '' ], [ '_' ] ],
+        [ '_a_b_c_', 'abc', { '': '_' } ],
+        [ '_a_bc', 'abc', { '': '_' }, 2 ],
+        [ '-ö-ü-', 'öü', '', '-' ],
+        [ 'x', '', '', 'x' ],
+        [ '_a-_c_', 'abc', [ 'b', '' ], [ '-', '_' ] ],
       ];
 
       values.forEach(function (value) {
@@ -1359,6 +1367,10 @@ function ahuacatlStringFunctionsTestSuite () {
       });
     },
     
+    testSubstituteDuplicateEmptyKeyUsesFirst: function () {
+      assertEqual([ '_a_b_c_' ], getQueryResults(`RETURN SUBSTITUTE('abc', { '': '_', '': '-' })`));
+    },
+
 // //////////////////////////////////////////////////////////////////////////////
 // / @brief test substitute function
 // //////////////////////////////////////////////////////////////////////////////
```

---

### Incident Patch 15: `ed2ca987` (2026-09-24)
**Commit Message**: Fix empty search and simplify

**File**: `arangod/Aql/Function/StringFunctions.cpp` (modified, +54/-98)
```diff
@@ -52,6 +52,7 @@
 #include <unicode/uchar.h>
 #include <unicode/unistr.h>
 
+#include <algorithm>
 #include <cstdint>
 #include <cstring>
 #include <string_view>
@@ -772,21 +773,21 @@ AqlValue functions::Substitute(ExpressionContext* expressionContext,
   velocypack::StringSink adapter(buffer.get());
 
   appendAsString(vopts, adapter, value);
-  if (buffer->empty()) {
-    // ICU's StringSearch rejects an empty text with U_ILLEGAL_ARGUMENT_ERROR
-    return AqlValue(*buffer);
-  }
   icu_64_64::UnicodeString unicodeStr(buffer->data(),
                                       static_cast<int32_t>(buffer->length()));
 
   auto& server = trx->vocbase().server();
   auto locale = server.getFeature<LanguageFeature>().getLocale();
-  // we can't copy the search instances, thus use pointers:
+  // we can't copy the search instances, thus use pointers.
+  // ICU's StringSearch rejects empty patterns and texts
   std::vector<std::unique_ptr<icu_64_64::StringSearch>> searchVec;
   searchVec.reserve(matchPatterns.size());
   UErrorCode status = U_ZERO_ERROR;
   for (auto const& searchStr : matchPatterns) {
-    // create a vector of string searches
+    if (searchStr.isEmpty() || unicodeStr.isEmpty()) {
+      searchVec.push_back(nullptr);
+      continue;
+    }
     searchVec.push_back(std::make_unique<icu_64_64::StringSearch>(
         searchStr, unicodeStr, locale, nullptr, status));
     if (U_FAILURE(status)) {
@@ -795,118 +796,73 @@ AqlValue functions::Substitute(ExpressionContext* expressionContext,
     }
   }
 
-  std::vector<std::pair<int32_t, int32_t>> srchResultPtrs;
+  using Match = std::pair<int32_t, int32_t>;
+  auto const fromSearch = [&](size_t which, int32_t pos) -> Match {
+    if (pos == USEARCH_DONE) {
+      return {pos, 0};
+    }
+    return {pos, searchVec[which]->getMatchedLength()};
+  };
+  auto const firstMatch = [&](size_t which) -> Match {
+    if (searchVec[which] == nullptr) {
+      return {matchPatterns[which].isEmpty() ? 0 : USEARCH_DONE, 0};
+    }
+    return fromSearch(which, searchVec[which]->first(status));
+  };
+  auto const nextMatch = [&](size_t which, int32_t pos) -> Match {
+    if (searchVec[which] == nullptr) {
+      return {pos < unicodeStr.length() ? unicodeStr.moveIndex32(pos, 1)
+                                        : USEARCH_DONE,
+              0};
+    }
+    return fromSearch(which, searchVec[which]->next(status));
+  };
+
+  std::vector<Match> srchResultPtrs;
   std::string utf8;
   srchResultPtrs.reserve(matchPatterns.size());
-  for (auto& search : searchVec) {
+  for (size_t i = 0; i < matchPatterns.size(); ++i) {
     // We now find the first hit for each search string.
-    auto pos = search->first(status);
+    srchResultPtrs.push_back(firstMatch(i));
     if (U_FAILURE(status)) {
       registerICUWarning(expressionContext, AFN, status);
       return AqlValue(AqlValueHintNull());
     }
-
-    int32_t len = 0;
-    if (pos != USEARCH_DONE) {
-      len = search->getMatchedLength();
-    }
-    srchResultPtrs.push_back(std::make_pair(pos, len));
   }
 
   icu_64_64::UnicodeString result;
   int32_t lastStart = 0;
-  int64_t count = 0;
-  while (true) {
-    int which = -1;
-    int32_t pos = USEARCH_DONE;
-    int32_t mLen = 0;
-    int i = 0;
-    for (auto resultPair : srchResultPtrs) {
-      // We locate the nearest matching search result.
-      int32_t thisPos;
-      thisPos = resultPair.first;
-      if ((pos == USEARCH_DONE) || (pos > thisPos)) {
-        if (thisPos != USEARCH_DONE) {
-          pos = thisPos;
-          which = i;
-          mLen = resultPair.second;
-        }
-      }
-      i++;
-    }
-    if (which == -1) {
+  for (int64_t count = 0; limit == -1 || count < limit; ++count) {
+    auto best = std::ranges::min_element(
+        srchResultPtrs, [](Match const& a, Match const& b) {
+          return a.first != USEARCH_DONE &&
+                 (b.first == USEARCH_DONE || a.first < b.first);
+        });
+    if (best->first == USEARCH_DONE) {
       break;
     }
-    // from last match to this match, copy the original string.
+    size_t const which = best - srchResultPtrs.begin();
+    auto const [pos, len] = *best;
+
     result.append(unicodeStr, lastStart, pos - lastStart);
-    if (replacePatterns.size() != 0) {
-      if (replacePatterns.size() > (size_t)which) {
-        result.append(replacePatterns[which]);
-      } else if (replaceWasPlainString) {
-        result.append(replacePatterns[0]);
-      }
+    if (which < replacePatterns.size()) {
+      result.append(replacePatterns[which]);
+    } else if (replaceWasPlainString) {
+      result.append(replacePatterns[0]);
     }
+    lastStart = pos + len;
 
-    // lastStart is the place up to we searched the source string
-    lastStart = pos + mLen;
-
-    // we try to search the next occurance of this string
-    auto& search = searchVec[which];
-    pos = search->next(status);
+    srchResultPtrs[which] = nextMatch(which, pos);
+    for (size_t i = 0; i < src
```

#### Recent Merged Pull Requests:
- **PR #23422** (2026-10-05): [3.11.14] Upgrade OpenSSL to 3.5.9 and OpenLDAP to 2.6.15 (@KVS85)
- **PR #23421** (2026-10-05): Upgrade OpenSSL to 3.5.9 (@KVS85)
- **PR #23420** (2026-10-05): Upgrade OpenSSL to 3.5.9 (@KVS85)
- **PR #23415** (2026-10-05): [COR-1048] Keep full documents visible across comma-separated MATCH patterns (@bluepal-avanthi-dundigala)
- **PR #23408** (2026-10-02): [4.0] Update node modules: brace-expansion to 5.0.12, fast-uri to 3.1.8 (@KVS85)
- **PR #23407** (2026-10-02): Update node modules: brace-expansion to 5.0.12, fast-uri to 3.1.8 (@KVS85)
- **PR #23406** (2026-10-05): [3.11.14] Update node modules: brace-expansion to 5.0.12, fast-uri to 3.1.8 (@KVS85)
- **PR #23405** (2026-10-05): Bug fix/arangosh login error handling (@dothebart)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
