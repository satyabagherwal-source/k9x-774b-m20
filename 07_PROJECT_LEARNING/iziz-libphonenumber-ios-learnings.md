# Forensic Learning Record (Deep Inspection): iziz/libPhoneNumber-iOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/iziz-libphonenumber-ios-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/iziz/libPhoneNumber-iOS](https://github.com/iziz/libPhoneNumber-iOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:27:32.102Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `iziz/libPhoneNumber-iOS`
- **Description**: iOS port of Google's libphonenumber with Objective-C core, Swift facade, SwiftUI input, and CocoaPods/SPM support
- **Primary Language / Ecosystem**: Objective-C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2381 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `libPhoneNumber-Demo/libPhoneNumber-Demo/PhoneUtilView.swift`
```
//
//  PhoneUtilView.swift
//  libPhoneNumber-Demo
//
//  Created by Rastaar Haghi on 7/17/20.
//  Copyright © 2020 Google LLC. All rights reserved.
//

import SwiftUI
import libPhoneNumberGeocoding

#if canImport(libPhoneNumber)
import libPhoneNumber
#elseif canImport(libPhoneNumber_iOS)
import libPhoneNumber_iOS
#endif

struct PhoneUtilView: View {
  @State private var countryCode: String = ""
  @State private var nationalNumber: String = ""
  @State private var phoneNumber: String = ""
  @State private var isValidNumber: Bool = false
  @State private var searchMade: Bool = false
  @State private var formatSelection = 0
  @State private var formattedPhoneNumber: String = ""

  var body: some View {
    VStack {
      Form {
        Section(header: Text("Phone Number")) {
          TextField("Ex: 19098611234", text: $phoneNumber)
            .textFieldStyle(RoundedBorderTextFieldStyle())
            .padding()
        }

        Section(header: Text("(Optional) Format Phone Number")) {
          Picker("Locale Options", selection: $formatSelection) {
            ForEach(formatOptions.indices, id: \.self) { index in
              Text(formatOptions[index])
                .tag(index)
            }
          }
        }

        Button(
          action: {
            self.parsePhoneNumber()
          },
          label: {
            Text("Parse Phone Number")
          })
      }
      if searchMade {
        if isValidNumber {
          SuccessResultView
        } else {
          FailedResultView
        }
      }
    }
    .navigationBarTitle(Text("PhoneUtil Parser"))
  }

  var SuccessResultView: some View {
    Form {
      Section(header: Text("Phone Number Validation")) {
        Text("Valid Number ✅")
      }
      if formattedPhoneNumber != "" {
        Section(header: Text("Formatted Phone Number")) {
          Text(self.formattedPhoneNumber)
        }
      }
      Section(header: Text("Country Code")) {
        Text(self.countryCode)
      }
      Section(header: Text("National Number")) {
        Text(self.nationalNumber)
      }
    }
  }

  var FailedResultView: some View {
    Form {
      Section(header: Text("Phone Number Validation")) {
        Text("Invalid Phone Number ❌")
      }
    }
  }
}

extension PhoneUtilView {
  func parsePhoneNumber() {
    do {
      self.searchMade = true
      let parsedPhoneNumber: NBPhoneNumber =
        try NBPhoneNumberUtil.sharedInstance().parse(self.phoneNumber, defaultRegion: Locale.current.regionCode!)
      self.isValidNumber = NBPhoneNumberUtil.sharedInstance().isValidNumber(parsedPhoneNumber)
      self.countryCode = parsedPhoneNumber.countryCode.stringValue
      self.nationalNumber = parsedPhoneNumber.nationalNumber.stringValue
      if self.formatSelection != 0 {
        self.formattedPhoneNumber = try
          NBPhoneNumberUtil.sharedInstance().format(
            parsedPhoneNumber,
            numberFormat:
              NBEPhoneNumberFormat(rawValue: self.formatSelection - 1)!)
      } else {
        self.formattedPhoneNumber = ""
      }

    } catch {
      print(error)
    }
  }
}

struct PhoneUtilView_Previews: PreviewProvider {
  static var previews: some View {
    PhoneUtilView()
  }
}

```

### Core Architecture Module: `libPhoneNumber-Demo/libPhoneNumber-Demo/ShortNumberUtilView.swift`
```
//
//  ShortNumberUtilView.swift
//  libPhoneNumber-Demo
//
//  Created by Rastaar Haghi on 7/20/20.
//  Copyright © 2020 Google LLC. All rights reserved.
//

import SwiftUI
import libPhoneNumberShortNumber

#if canImport(libPhoneNumber)
import libPhoneNumber
#elseif canImport(libPhoneNumber_iOS)
import libPhoneNumber_iOS
#endif

struct ShortNumberUtilView: View {
  @State private var phoneNumber: String = ""
  @State private var isValidShortNumber: Bool = false
  @State private var isEmergencyNumber: Bool = false
  @State private var estimatedCostOfCall: NBEShortNumberCost?
  @State private var searchMade: Bool = false

  var body: some View {
    VStack {
      Form {
        Section(header: Text("Phone Number")) {
          TextField("Ex: 19098611234", text: $phoneNumber)
            .textFieldStyle(RoundedBorderTextFieldStyle())
            .padding()
        }
        Button(
          action: {
            self.parsePhoneNumber()
          },
          label: {
            Text("Parse Short Number")
          })
      }
      if searchMade {
        if isValidShortNumber {
          SuccessResultView
        } else {
          FailedResultView
        }
      }
    }
    .navigationBarTitle(Text("Short Number Util Parser"))
  }

  var SuccessResultView: some View {
    Form {
      Section(header: Text("Phone Number Validation")) {
        Text("Valid Short Number ✅")
      }
      Section(header: Text("Emergency Number")) {
        if isEmergencyNumber {
          Text(phoneNumber) + Text(" is an emergency number 🚨")
        } else {
          Text(phoneNumber) + Text(" is not an emergency number")
        }
      }

      Section(header: Text("Expected Cost of Short Number")) {
        if estimatedCostOfCall == NBEShortNumberCost(rawValue: 1) {
          Text("Toll Free Number")
        } else if estimatedCostOfCall == NBEShortNumberCost(rawValue: 2) {
          Text("Standard Rate Number")
        } else if estimatedCostOfCall == NBEShortNumberCost(rawValue: 3) {
          Text("Premium Rate Number")
        } else {
          Text("Unknown Number Cost")
        }
      }
    }
  }

  var FailedResultView: some View {
    Form {
      Section(header: Text("Phone Number Validation")) {
        Text("Invalid Short Number ❌")
      }
    }
  }
}

extension ShortNumberUtilView {
  func parsePhoneNumber() {
    do {
      self.searchMade = true
      let parsedPhoneNumber: NBPhoneNumber =
        try NBPhoneNumberUtil.sharedInstance().parse(self.phoneNumber, defaultRegion: Locale.current.regionCode!)
      self.isValidShortNumber = NBShortNumberUtil.sharedInstance().isValidShortNumber(parsedPhoneNumber)
      self.isEmergencyNumber =
        NBShortNumberUtil.sharedInstance().isEmergencyNumber(
          self.phoneNumber,
          forRegion: Locale.current.regionCode!)
      self.estimatedCostOfCall = NBShortNumberUtil.sharedInstance().expectedCost(of: parsedPhoneNumber)
    } catch {
      print(error)
    }
  }
}

struct ShortNumberUtilView_Previews: PreviewProvider {
  static var previews: some View {
    ShortNumberUtilView()
  }
}

```

### Core Architecture Module: `libPhoneNumber/NBPhoneNumberUtil.h`
```
//
//  NBPhoneNumberUtil.h
//  libPhoneNumber
//
//  Created by tabby on 2015. 2. 8..
//  Copyright (c) 2015년 ohtalk.me. All rights reserved.
//

#import <Foundation/Foundation.h>
#import "NBPhoneNumberDefines.h"

@class NBPhoneMetaData, NBPhoneNumber, NBMetadataHelper;

@interface NBPhoneNumberUtil : NSObject

+ (NBPhoneNumberUtil * _Nonnull)sharedInstance;
- (instancetype _Nonnull)initWithMetadataHelper:(NBMetadataHelper * _Nonnull)helper;

- (instancetype _Nonnull)init NS_UNAVAILABLE;

@property(nonatomic, strong, readonly, nonnull) NSDictionary * DIGIT_MAPPINGS;

// regular expressions
- (NSArray * _Nullable)matchesByRegex:(NSString * _Nonnull)sourceString regex:(NSString * _Nonnull)pattern;
- (NSArray * _Nullable)matchedStringByRegex:(NSString * _Nonnull)sourceString regex:(NSString * _Nonnull)pattern;
- (NSString * _Nonnull)replaceStringByRegex:(NSString * _Nonnull)sourceString
                                      regex:(NSString * _Nonnull)pattern
                               withTemplate:(NSString * _Nonnull)templateString;
- (int)stringPositionByRegex:(NSString * _Nullable)sourceString regex:(NSString * _Nullable)pattern;

// libPhoneNumber Util functions
- (NSString * _Nonnull)convertAlphaCharactersInNumber:(NSString * _Nonnull)number;

- (NSString * _Nonnull)normalize:(NSString * _Nonnull)number;
- (NSString * _Nonnull)normalizeDigitsOnly:(NSString * _Nonnull)number;
- (NSString * _Nonnull)normalizeDiallableCharsOnly:(NSString * _Nonnull)number;

- (BOOL)isNumberGeographical:(NBPhoneNumber * _Nonnull)phoneNumber;

- (NSString * _Nonnull)extractPossibleNumber:(NSString * _Nonnull)number;
- (NSNumber * _Nonnull)extractCountryCode:(NSString * _Nonnull)fullNumber nationalNumber:(NSString * _Nullable * _Nullable)nationalNumber;
- (NSString * _Nonnull)countryCodeByCarrier;

- (NSString * _Nullable)getNddPrefixForRegion:(NSString * _Nullable)regionCode stripNonDigits:(BOOL)stripNonDigits;
- (NSString * _Nonnull)getNationalSignificantNumber:(NBPhoneNumber * _Nonnull)phoneNumber;

- (NBPhoneMetaData * _Nullable)getMetadataForRegion:(NSString * _Nullable)regionCode;
- (NBPhoneMetaData * _Nullable)getMetadataForNonGeographicalRegion:(NSNumber * _Nullable)countryCallingCode;
- (NSArray * _Nullable)getSupportedRegions;
- (NSArray<NSNumber *> * _Nonnull)getSupportedCallingCodes;
- (NSArray<NSNumber *> * _Nonnull)getSupportedGlobalNetworkCallingCodes;
- (NSArray<NSNumber *> * _Nonnull)getSupportedTypesForRegion:(NSString * _Nullable)regionCode;
- (NSArray<NSNumber *> * _Nonnull)getSupportedTypesForNonGeoEntity:(NSNumber * _Nonnull)countryCallingCode;

- (NBEPhoneNumberType)getNumberType:(NBPhoneNumber * _Nonnull)phoneNumber;

- (NSNumber * _Nonnull)getCountryCodeForRegion:(NSString * _Nullable)regionCode;

- (NSString * _Nonnull)getRegionCodeForCountryCode:(NSNumber * _Nonnull)countryCallingCode;
- (NSArray * _Nullable)getRegionCodesForCountryCode:(NSNumber * _Nonnull)countryCallingCode;
- (NSString * _Nullable)getRegionCodeForNumber:(NBPhoneNumber * _Nullable)phoneNumber;

- (NBPhoneNumber * _Nullable)getExampleNumber:(NSString * _Nonnull)regionCode error:(NSError * _Nullable __autoreleasing * _Nullable)error;
- (NBPhoneNumber * _Nullable)getExampleNumberForType:(NSString * _Nonnull)regionCode
                                                type:(NBEPhoneNumberType)type
                                               error:(NSError * _Nullable __autoreleasing * _Nullable)error;
- (NBPhoneNumber * _Nullable)getExampleNumberForNonGeoEntity:(NSNumber * _Nonnull)countryCallingCode
                                                       error:(NSError * _Nullable * _Nullable)error;

- (BOOL)canBeInternationallyDialled:(NBPhoneNumber * _Nonnull)number error:(NSError * _Nullable * _Nullable)error;

- (BOOL)truncateTooLongNumber:(NBPhoneNumber * _Nonnull)number;

- (BOOL)isValidNumber:(NBPhoneNumber * _Nonnull)number;
- (BOOL)isViablePhoneNumber:(NSString * _Nonnull)phoneNumber;
- (BOOL)isAlphaNumber:(NSString * _Nonnull)number;
- (BOOL)isValidNumberForRegion:(NBPhoneNumber * _Nonnull)number regionCode:(NSString * _Nonnull)regionCode;
- (BOOL)isNANPACountry:(NSString * _Nullable)regionCode;
- (BOOL)isLeadingZeroPossible:(NSNumber * _Nonnull)countryCallingCode;

- (NBEValidationResult)isPossibleNumberWithReason:(NBPhoneNumber * _Nonnull)number
                                            error:(NSError * _Nullable * _Nullable)error;

- (BOOL)isPossibleNumber:(NBPhoneNumber * _Nonnull)number;
- (BOOL)isPossibleNumber:(NBPhoneNumber * _Nonnull)number error:(NSError * _Nullable * _Nullable)error;
- (BOOL)isPossibleNumber:(NBPhoneNumber * _Nonnull)number forType:(NBEPhoneNumberType)type;
- (NBEValidationResult)isPossibleNumberWithReason:(NBPhoneNumber * _Nonnull)number
                                          forType:(NBEPhoneNumberType)type;
- (BOOL)isPossibleNumberString:(NSString * _Nonnull)number
             regionDialingFrom:(NSString * _Nullable)regionDialingFrom
                         error:(NSError * _Nullable * _Nullable)error;

- (NBEMatchType)isNumberMatch:(id _Nonnull)firstNumberIn second:(id _Nonnull)secondNumberIn error:(NSError * _Nullable * _Nullable)error;

- (int)getLengthOfGeographicalAreaCode:(NBPhoneNumber * _Nonnull)phoneNumber error:(NSError * _Nullable * _Nullable)error;
- (int)getLengthOfNationalDestinationCode:(NBPhoneNumber * _Nonnull)phoneNumber error:(NSError * _Nullable * _Nullable)error;

- (BOOL)maybeStripNationalPrefixAndCarrierCode:(NSString * _Nullable * _Nullable)number
                                      metadata:(NBPhoneMetaData * _Nonnull)metadata
                                   carrierCode:(NSString * _Nullable * _Nullable)carrierCode;
- (NSString * _Nonnull)maybeStripExtension:(NSString * _Nonnull * _Nonnull)number;
- (NBECountryCodeSource)maybeStripInternationalPrefixAndNormalize:(NSString * _Nullable * _Nullable)numberStr
                                                possibleIddPrefix:(NSString * _Nonnull)possibleIddPrefix;

- (NSNumber * _Nonnull)maybeExtractCountryCode:(NSString * _Nonnull)number
                                      metadata:(NBPhoneMetaData * _Nullable)defaultRegionMetadata
                                nationalNumber:(NSString * _Nullable * _Nullable)nationalNumber
                                  keepRawInput:(BOOL)keepRawInput
                                   phoneNumber:(NBPhoneNumber * _Nullable * _Nullable)phoneNumber
                                         error:(NSError * _Nullable * _Nullable)error;

- (NBPhoneNumber * _Nullable)parse:(NSString * _Nullable)numberToParse
                     defaultRegion:(NSString * _Nullable)defaultRegion
                             error:(NSError * _Nullable * _Nullable)error;
- (NBPhoneNumber * _Nullable)parseAndKeepRawInput:(NSString * _Nonnull)numberToParse
                                    defaultRegion:(NSString * _Nullable)defaultRegion
                                            error:(NSError * _Nullable * _Nullable)error;
- (NBPhoneNumber * _Nullable)parseWithPhoneCarrierRegion:(NSString * _Nullable)numberToParse
                                                   error:(NSError * _Nullable * _Nullable)error;

- (NSString * _Nullable)format:(NBPhoneNumber * _Nonnull)phoneNumber
                  numberFormat:(NBEPhoneNumberFormat)numberFormat
                         error:(NSError * _Nullable * _Nullable)error;
- (NSString * _Nullable)formatByPattern:(NBPhoneNumber * _Nonnull)number
                           numberFormat:(NBEPhoneNumberFormat)numberFormat
                     userDefinedFormats:(NSArray * _Nullable)userDefinedFormats
                                  error:(NSError * _Nullable * _Nullable)error;
- (NSString * _Nullable)formatNumberForMobileDialing:(NBPhoneNumber * _Nonnull)number
                                   regionCallingFrom:(NSString * _Nonnull)regionCallingFrom
                                      withFormatting:(BOOL)withFormatting
                                               error:(NSError * _Nullable * _Nullable)error;
- (NSString * _Nullable)formatOutOfCountryCallingNumber:(NBPhoneNumber * _Nonnull)number
                                      regionCallingFrom:(NSString * _Nonnull)regionCallingFrom
                                                  error:(NSError * _Nullable * _Nullable)error;
- (NSString * _Nullable)formatOutOfCountryKeepingAlphaChars:(NBPhoneNumber * _Nonnull)number
                                          regionCallingFrom:(NSString * _Nonnull)regionCallingFrom
                                                      error:(NSError * _Nullable * _Nullable)error;
- (NSString * _Nullable)formatNationalNumberWithCarrierCode:(NBPhoneNumber * _Nonnull)number
                                                carrierCode:(NSString * _Nullable)carrierCode
                                                      error:(NSError * _Nullable * _Nullable)error;
- (NSString * _Nullable)formatInOriginalFormat:(NBPhoneNumber * _Nonnull)number
                             regionCallingFrom:(NSString * _Nonnull)regionCallingFrom
                                         error:(NSError * _Nullable * _Nullable)error;
- (NSString * _Nullable)formatNationalNumberWithPreferredCarrierCode:(NBPhoneNumber * _Nonnull)number
                                       fallbackCarrierCode:(NSString * _Nonnull)fallbackCarrierCode
                                                     error:(NSError * _Nullable * _Nullable)error;
- (BOOL)formattingRuleHasFirstGroupOnly:(NSString * _Nullable)nationalPrefixFormattingRule;

/**
 * Returns the mobile token for the provided country calling code if it has one, otherwise
 * returns an empty string. A mobile token is a number inserted before the area code when dialing
 * a mobile number from that country from abroad.
 *
 * @param countryCallingCode  the country calling code for which we want the mobile token.
 * @return  the mobile token, as a string, for the given country calling code.
 */
- (NSString * _Nonnull)getCountryMobileTokenFromCo
```

### Core Architecture Module: `libPhoneNumberShortNumber/NBShortNumberUtil.h`
```
//
//  NBShortNumberUtil.h
//  libPhoneNumberiOS
//
//  Created by Paween Itthipalkul on 11/29/17.
//  Copyright © 2017 Google LLC. All rights reserved.
//

#import <Foundation/Foundation.h>

@class NBPhoneNumber;
@class NBShortNumberMetadataHelper;
@class NBPhoneNumberUtil;

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSUInteger, NBEShortNumberCost) {
  NBEShortNumberCostUnknown = 0,
  NBEShortNumberCostTollFree = 1,
  NBEShortNumberCostStandardRate = 2,
  NBEShortNumberCostPremiumRate = 3,
};

@interface NBShortNumberUtil : NSObject

@property(nonatomic) NSDictionary<NSNumber *, NSArray<NSString *> *> *countryToRegionCodeMap;

/// Short number util singleton with a default metadata helper.
+ (NBShortNumberUtil *)sharedInstance;

/**
 * Convenience method to get a list of regions the short-number library has metadata for.
 */
- (NSArray<NSString *> *)getSupportedRegions;

/**
 * Gets a valid short number for the specified region.
 *
 * @param regionCode the region for which an example short number is needed
 * @return a valid short number for the specified region, or an empty string when unavailable.
 */
- (NSString *)getExampleShortNumber:(nullable NSString *)regionCode;

/**
 * Gets a valid short number for the specified cost category.
 *
 * @param regionCode the region for which an example short number is needed
 * @param cost the cost category of number that is needed
 * @return a valid short number for the specified region and cost, or an empty string when unavailable.
 */
- (NSString *)getExampleShortNumberForRegion:(NSString *)regionCode
                                        cost:(NBEShortNumberCost)cost;

- (instancetype)init NS_UNAVAILABLE;

/// Initialize short number util with a metadata helper.
/// @param helper A metadata helper.
- (instancetype)initWithMetadataHelper:(NBShortNumberMetadataHelper *)helper
                       phoneNumberUtil:(NBPhoneNumberUtil *)phoneNumberUtil;

/**
 * Check whether a short number is a possible number when dialed from the given region. This
 * provides a more lenient check than {@link #isValidShortNumberForRegion}.
 *
 * @param phoneNumber the short number to check
 * @param regionDialingFrom the region from which the number is dialed
 * @return whether the number is a possible short number
 */
- (BOOL)isPossibleShortNumber:(NBPhoneNumber *)phoneNumber forRegion:(NSString *)regionDialingFrom;

/**
 * Check whether a short number is a possible number. If a country calling code is shared by
 * multiple regions, this returns true if it's possible in any of them. This provides a more
 * lenient check than {@link #isValidShortNumber}. See {@link
 * #isPossibleShortNumberForRegion(PhoneNumber, String)} for details.
 *
 * @param phoneNumber the short number to check
 * @return whether the number is a possible short number
 */
- (BOOL)isPossibleShortNumber:(NBPhoneNumber *)phoneNumber;

/**
 * Tests whether a short number matches a valid pattern in a region. Note that this doesn't verify
 * the number is actually in use, which is impossible to tell by just looking at the number
 * itself.
 *
 * @param phoneNumber the short number for which we want to test the validity
 * @param regionDialingFrom the region from which the number is dialed
 * @return whether the short number matches a valid pattern
 */
- (BOOL)isValidShortNumber:(NBPhoneNumber * _Nonnull)phoneNumber forRegion:(NSString * _Nonnull)regionDialingFrom;

/**
 * Tests whether a short number matches a valid pattern. If a country calling code is shared by
 * multiple regions, this returns true if it's valid in any of them. Note that this doesn't verify
 * the number is actually in use, which is impossible to tell by just looking at the number
 * itself. See {@link #isValidShortNumberForRegion(PhoneNumber, String)} for details.
 *
 * @param phoneNumber the short number for which we want to test the validity
 * @return whether the short number matches a valid pattern
 */
- (BOOL)isValidShortNumber:(NBPhoneNumber * _Nonnull)phoneNumber;

/**
 * Gets the expected cost category of a short number when dialed from a region (however, nothing
 * is implied about its validity). If it is important that the number is valid, then its validity
 * must first be checked using {@link #isValidShortNumberForRegion}. Note that emergency numbers
 * are always considered toll-free. Example usage:
 * <pre>{@code
 * // The region for which the number was parsed and the region we subsequently check against
 * // need not be the same. Here we parse the number in the US and check it for Canada.
 * PhoneNumber number = phoneUtil.parse("110", "US");
 * ...
 * String regionCode = "CA";
 * ShortNumberInfo shortInfo = ShortNumberInfo.getInstance();
 * if (shortInfo.isValidShortNumberForRegion(shortNumber, regionCode)) {
 *   ShortNumberCost cost = shortInfo.getExpectedCostForRegion(number, regionCode);
 *   // Do something with the cost information here.
 * }}</pre>
 *
 * @param phoneNumber the short number for which we want to know the expected cost category
 * @param regionDialingFrom the region from which the number is dialed
 * @return the expected cost category for that region of the short number. Returns UNKNOWN_COST if
 *     the number does not match a cost category. Note that an invalid number may match any cost
 *     category.
 */
- (NBEShortNumberCost)expectedCostOfPhoneNumber:(NBPhoneNumber *)phoneNumber
                                      forRegion:(NSString *)regionDialingFrom;

/**
 * Gets the expected cost category of a short number (however, nothing is implied about its
 * validity). If the country calling code is unique to a region, this method behaves exactly the
 * same as {@link #getExpectedCostForRegion(PhoneNumber, String)}. However, if the country
 * calling code is shared by multiple regions, then it returns the highest cost in the sequence
 * PREMIUM_RATE, UNKNOWN_COST, STANDARD_RATE, TOLL_FREE. The reason for the position of
 * UNKNOWN_COST in this order is that if a number is UNKNOWN_COST in one region but STANDARD_RATE
 * or TOLL_FREE in another, its expected cost cannot be estimated as one of the latter since it
 * might be a PREMIUM_RATE number.
 * <p>
 * For example, if a number is STANDARD_RATE in the US, but TOLL_FREE in Canada, the expected
 * cost returned by this method will be STANDARD_RATE, since the NANPA countries share the same
 * country calling code.
 * <p>
 * Note: If the region from which the number is dialed is known, it is highly preferable to call
 * {@link #getExpectedCostForRegion(PhoneNumber, String)} instead.
 *
 * @param phoneNumber the short number for which we want to know the expected cost category
 * @return the highest expected cost category of the short number in the region(s) with the given
 *     country calling code
 */
- (NBEShortNumberCost)expectedCostOfPhoneNumber:(NBPhoneNumber *)phoneNumber;

/**
 * Given a valid short number, determines whether it is carrier-specific (however, nothing is
 * implied about its validity). Carrier-specific numbers may connect to a different end-point, or
 * not connect at all, depending on the user's carrier. If it is important that the number is
 * valid, then its validity must first be checked using {@link #isValidShortNumber} or
 * {@link #isValidShortNumberForRegion}.
 *
 * @param phoneNumber the valid short number to check
 * @return whether the short number is carrier-specific, assuming the input was a valid short
 *     number
 */
- (BOOL)isPhoneNumberCarrierSpecific:(NBPhoneNumber *)phoneNumber;

/**
 * Given a valid short number, determines whether it is carrier-specific when dialed from the
 * given region (however, nothing is implied about its validity). Carrier-specific numbers may
 * connect to a different end-point, or not connect at all, depending on the user's carrier. If
 * it is important that the number is valid, then its validity must first be checked using
 * {@link #isValidShortNumber} or {@link #isValidShortNumberForRegion}. Returns false if the
 * number doesn't match the region provided.
 *
 * @param phoneNumber  the valid short number to check
 * @param regionDialingFrom  the region from which the number is dialed
 * @return  whether the short number is carrier-specific in the provided region, assuming the
 *     input was a valid short number
 */
- (BOOL)isPhoneNumberCarrierSpecific:(NBPhoneNumber *)phoneNumber forRegion:(NSString *)regionCode;

/**
 * Given a valid short number, determines whether it is an SMS service (however, nothing is
 * implied about its validity). An SMS service is where the primary or only intended usage is to
 * receive and/or send text messages (SMSs). This includes MMS as MMS numbers downgrade to SMS if
 * the other party isn't MMS-capable. If it is important that the number is valid, then its
 * validity must first be checked using {@link #isValidShortNumber} or {@link
 * #isValidShortNumberForRegion}. Returns false if the number doesn't match the region provided.
 *
 * @param phoneNumber  the valid short number to check
 * @param regionDialingFrom  the region from which the number is dialed
 * @return  whether the short number is an SMS service in the provided region, assuming the input
 *     was a valid short number
 */
- (BOOL)isPhoneNumberSMSService:(NBPhoneNumber *)phoneNumber forRegion:(NSString *)regionCode;

/**
 * Returns true if the given number, exactly as dialed, might be used to connect to an emergency
 * service in the given region.
 * <p>
 * This method accepts a string, rather than a PhoneNumber, because it needs to distinguish
 * cases such as "+1 911" and "911", where the former may not connect to an emergency service in
 * all cases but the latter would. This method takes into account cases where the number might
 * contain formatting, or might have additional digits appended (when it is okay to do that in
 * the specified region).
 *
 * @param number the phone number to test
 * @param regionCode the region where the phone number is being dialed
 * @return whether the
```

### Core Architecture Module: `libPhoneNumberSwiftCore/PhoneNumberSwiftCore.swift`
```
import Foundation
#if canImport(libPhoneNumber)
import libPhoneNumber
#elseif canImport(libPhoneNumber_iOS)
import libPhoneNumber_iOS
#endif

/// A parsed phone number.
///
/// This is the Objective-C model object. It is a mutable reference type and is
/// therefore not `Sendable`: do not share one instance across concurrency
/// domains. Use ``PhoneNumberValue`` for anything that crosses an actor
/// boundary, gets stored, or is sent over the wire.
public typealias PhoneNumber = NBPhoneNumber

@available(*, deprecated, message: "Unused. Every throwing API reports failures as PhoneNumberValueError or the underlying NSError. This type will be removed in the next major version.")
public enum PhoneNumberError: Error {
    case operationFailed(String)

    static func fallback(_ operation: String) -> PhoneNumberError {
        .operationFailed("\(operation) failed without an NSError.")
    }
}

/// The error reported by every non-throwing `Result`-returning API on
/// ``PhoneNumberUtility``.
public enum PhoneNumberValueError: Error, Equatable, Sendable {
    /// The text could not be parsed as a phone number.
    case invalidInput(String)
    /// The number parsed, but could not be rendered in the requested format.
    case formattingFailed(String)
    /// An error raised by the Objective-C core, flattened to its description.
    case underlying(String)

    /// Wraps an arbitrary error thrown by the Objective-C core.
    public init(_ error: Error) {
        self = .underlying(error.localizedDescription)
    }
}

extension PhoneNumberValueError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case let .invalidInput(message),
             let .formattingFailed(message),
             let .underlying(message):
            return message
        }
    }
}

public struct PhoneNumberValue: Codable, Hashable, Sendable {
    public let e164: String
    public let regionCode: String?
    public let nationalSignificantNumber: String
    public let type: PhoneNumberType

    public init(
        e164: String,
        regionCode: String?,
        nationalSignificantNumber: String,
        type: PhoneNumberType
    ) {
        self.e164 = e164
        self.regionCode = regionCode
        self.nationalSignificantNumber = nationalSignificantNumber
        self.type = type
    }
}

public enum PhoneNumberFormat: Int, Codable, Sendable {
    case e164 = 0
    case international = 1
    case national = 2
    case rfc3966 = 3

    var objcValue: NBEPhoneNumberFormat {
        NBEPhoneNumberFormat(rawValue: rawValue)!
    }
}

public enum PhoneNumberType: Int, Codable, Sendable {
    case fixedLine = 0
    case mobile = 1
    case fixedLineOrMobile = 2
    case tollFree = 3
    case premiumRate = 4
    case sharedCost = 5
    case voip = 6
    case personalNumber = 7
    case pager = 8
    case uan = 9
    case voicemail = 10
    case unknown = -1

    init(_ objcValue: NBEPhoneNumberType) {
        self = PhoneNumberType(rawValue: objcValue.rawValue) ?? .unknown
    }

    var objcValue: NBEPhoneNumberType {
        NBEPhoneNumberType(rawValue: rawValue)!
    }
}

public enum ValidationResult: Int, Codable, Sendable {
    case isPossible = 0
    case invalidCountryCode = 1
    case tooShort = 2
    case tooLong = 3
    case isPossibleLocalOnly = 4
    case invalidLength = 5
    case unknown = 6

    init(_ objcValue: NBEValidationResult) {
        self = ValidationResult(rawValue: objcValue.rawValue) ?? .unknown
    }
}

public enum MatchType: Int, Codable, Sendable {
    case notANumber = 0
    case noMatch = 1
    case shortNSNMatch = 2
    case nsnMatch = 3
    case exactMatch = 4

    init(_ objcValue: NBEMatchType) {
        self = MatchType(rawValue: objcValue.rawValue) ?? .notANumber
    }
}

public enum CountryCodeSource: Int, Codable, Sendable {
    case fromNumberWithPlusSign = 1
    case fromNumberWithIDD = 5
    case fromNumberWithoutPlusSign = 10
    case fromDefaultCountry = 20

    init(_ objcValue: NBECountryCodeSource) {
        self = CountryCodeSource(rawValue: objcValue.rawValue) ?? .fromNumberWithPlusSign
    }
}

/// The Objective-C core this facade wraps is safe to share across threads: its
/// regular-expression caches are lock-protected, its derived metadata tables are
/// built under a lock, and every table it reads is immutable after
/// initialization. Sendable is therefore asserted rather than checked, because
/// the compiler cannot see the Objective-C side's locking.
public final class PhoneNumberUtility: @unchecked Sendable {
    public static let shared = PhoneNumberUtility()

    /// The wrapped Objective-C utility.
    ///
    /// Exposed as an escape hatch for APIs this facade does not surface yet.
    /// Prefer the Swift methods on this type; anything reachable only through
    /// `objc` is not covered by the facade's source-stability guarantees.
    public let objc: NBPhoneNumberUtil

    public init(objc: NBPhoneNumberUtil = NBPhoneNumberUtil.sharedInstance()) {
        self.objc = objc
    }

    public var supportedRegions: [String] {
        (objc.getSupportedRegions() as? [String]) ?? []
    }

    public var supportedCallingCodes: [Int] {
        objc.getSupportedCallingCodes().map(\.intValue)
    }

    public var supportedGlobalNetworkCallingCodes: [Int] {
        objc.getSupportedGlobalNetworkCallingCodes().map(\.intValue)
    }

    public func parse(_ number: String?, defaultRegion: String?) throws -> PhoneNumber {
        try objc.parse(number, defaultRegion: defaultRegion)
    }

    public func parseResult(_ number: String?, defaultRegion: String?) -> Result<PhoneNumber, Error> {
        Result {
            try parse(number, defaultRegion: defaultRegion)
        }
    }

    public func parseAndKeepRawInput(_ number: String, defaultRegion: String?) throws -> PhoneNumber {
        try objc.parseAndKeepRawInput(number, defaultRegion: defaultRegion)
    }

    public func parseWithCarrierRegion(_ number: String?) throws -> PhoneNumber {
        try objc.parse(withPhoneCarrierRegion: number)
    }

    public func format(_ number: PhoneNumber, as format: PhoneNumberFormat) throws -> String {
        try objc.format(number, numberFormat: format.objcValue)
    }

    public func value(from number: PhoneNumber) -> Result<PhoneNumberValue, PhoneNumberValueError> {
        guard let e164 = try? format(number, as: .e164) else {
            return .failure(.formattingFailed("Unable to format phone number as E.164."))
        }

        return .success(
            PhoneNumberValue(
                e164: e164,
                regionCode: regionCode(for: number),
                nationalSignificantNumber: nationalSignificantNumber(for: number),
                type: type(of: number)
            )
        )
    }

    public func value(from text: String, defaultRegion: String?) -> Result<PhoneNumberValue, PhoneNumberValueError> {
        do {
            let number = try parse(text, defaultRegion: defaultRegion)
            return value(from: number)
        } catch {
            return .failure(.invalidInput(error.localizedDescription))
        }
    }

    public func phoneNumber(from value: PhoneNumberValue) -> Result<PhoneNumber, PhoneNumberValueError> {
        do {
            return .success(try parse(value.e164, defaultRegion: nil))
        } catch {
            return .failure(PhoneNumberValueError(error))
        }
    }

    public func formatForMobileDialing(
        _ number: PhoneNumber,
        regionCallingFrom: String,
        withFormatting: Bool
    ) throws -> String {
        try objc.formatNumber(
            forMobileDialing: number,
            regionCallingFrom: regionCallingFrom,
            withFormatting: withFormatting
        )
    }

    public func formatOutOfCountryCallingNumber(
        _ number: PhoneNumber,
        regionCallingFrom: String
    ) throws -> String {
        try objc.formatOut(
            ofCountryCalling: number,
            regionCallingFrom: regionCallingFrom
        )
    }

    public func isValidNumber(_ number: PhoneNumber) -> Bool {
        objc.isValidNumber(number)
    }

    public func isValidNumber(_ number: PhoneNumber, forRegion regionCode: String) -> Bool {
        objc.isValidNumber(forRegion: number, regionCode: regionCode)
    }

    public func isPossibleNumber(_ number: PhoneNumber) -> Bool {
        objc.isPossibleNumber(number)
    }

    public func isPossibleNumber(_ number: PhoneNumber, for type: PhoneNumberType) -> Bool {
        objc.isPossibleNumber(number, for: type.objcValue)
    }

    public func possibleNumberReason(_ number: PhoneNumber) throws -> ValidationResult {
        var error: NSError?
        let result = objc.isPossibleNumber(withReason: number, error: &error)
        if let error {
            throw error
        }
        return ValidationResult(result)
    }

    public func possibleNumberReason(_ number: PhoneNumber, for type: PhoneNumberType) -> ValidationResult {
        ValidationResult(objc.isPossibleNumber(withReason: number, for: type.objcValue))
    }

    public func type(of number: PhoneNumber) -> PhoneNumberType {
        PhoneNumberType(objc.getNumberType(number))
    }

    public func nationalSignificantNumber(for number: PhoneNumber) -> String {
        objc.getNationalSignificantNumber(number)
    }

    public func regionCode(for number: PhoneNumber) -> String? {
        objc.getRegionCode(for: number)
    }

    public func countryCode(forRegion regionCode: String?) -> Int {
        objc.getCountryCode(forRegion: regionCode).intValue
    }

    public func regionCode(forCountryCode countryCallingCode: Int) -> String {
        objc.getRegionCode(forCountryCode: NSNumber(value: countryCallingCode))
    }

    public func regionCodes(forCountryCode countryCallingCode: Int) -> [String] {
        (objc.getRegionCodes(forCountryCode: NSNumber(value: countryCallingCode)) as? [String]) ?? []
    }

    public func exampleNumber(forRegion reg
```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:6.0
// The swift-tools-version declares the minimum version of Swift required to build this package.
// Swift 6 tools are required so the Swift facade targets can build in the
// Swift 6 language mode and so visionOS can be declared as a platform.
import PackageDescription

let package = Package(
    name: "libPhoneNumber",
    platforms: [
        .macOS(.v12),
        .macCatalyst(.v15),
        .iOS(.v15),
        .tvOS(.v15),
        .watchOS("9.0"),
        .visionOS(.v1)
    ],
    products: [
        .library(
            name: "libPhoneNumber",
            targets: ["libPhoneNumber"]
        ),
        .library(
            name: "libPhoneNumberGeocoding",
            targets: ["libPhoneNumberGeocoding"]
        ),
        .library(
            name: "libPhoneNumberShortNumber",
            targets: ["libPhoneNumberShortNumber"]
        ),
        .library(
            name: "libPhoneNumberCarrier",
            targets: ["libPhoneNumberCarrier"]
        ),
        .library(
            name: "libPhoneNumberTimeZones",
            targets: ["libPhoneNumberTimeZones"]
        ),
        .library(
            name: "libPhoneNumberSwiftCore",
            targets: ["libPhoneNumberSwiftCore"]
        ),
        .library(
            name: "libPhoneNumberSwiftGeocoding",
            targets: ["libPhoneNumberSwiftGeocoding"]
        ),
        .library(
            name: "libPhoneNumberSwiftShortNumber",
            targets: ["libPhoneNumberSwiftShortNumber"]
        ),
        .library(
            name: "libPhoneNumberSwiftCarrier",
            targets: ["libPhoneNumberSwiftCarrier"]
        ),
        .library(
            name: "libPhoneNumberSwiftTimeZones",
            targets: ["libPhoneNumberSwiftTimeZones"]
        ),
        .library(
            name: "libPhoneNumberSwiftUI",
            targets: ["libPhoneNumberSwiftUI"]
        ),
        .library(
            name: "libPhoneNumberSwiftUIEnrichment",
            targets: ["libPhoneNumberSwiftUIEnrichment"]
        ),
        .library(
            name: "libPhoneNumberIOSSwift",
            targets: ["libPhoneNumberIOSSwift"]
        )
    ],
    targets: [
        .target(
            name: "libPhoneNumberTestsCommon",
            path: "libPhoneNumberTestsCommon",
            resources: [
                .copy("libPhoneNumberMetaDataForTesting.zip")
            ],
            publicHeadersPath: "."
        ),
        .target(
            name: "libPhoneNumberInternal",
            path: "libPhoneNumberInternal",
            publicHeadersPath: "."
        ),
        .target(
            name: "libPhoneNumber",
            dependencies: ["libPhoneNumberInternal"],
            path: "libPhoneNumber",
            exclude: ["Info.plist"],
            resources: [
                .process("PrivacyInfo.xcprivacy")
            ],
            publicHeadersPath: ".",
            cSettings: [
                .headerSearchPath("Internal")
            ],
            linkerSettings: [
                .linkedFramework("Contacts", .when(platforms: [.iOS, .macOS, .macCatalyst, .watchOS, .visionOS])),
            ]
        ),
        .testTarget(
            name: "libPhoneNumberTests",
            dependencies: [
                "libPhoneNumber",
                "libPhoneNumberTestsCommon",
            ],
            path: "libPhoneNumberTests"
        ),
        .target(
            name: "libPhoneNumberGeocodingMetaData",
            path: "libPhoneNumberGeocodingMetaData",
            resources: [
                .copy("GeocodingMetaData.bundle")
            ],
            publicHeadersPath: "."
        ),
        .target(
            name: "libPhoneNumberGeocoding",
            dependencies: [
                "libPhoneNumber",
                "libPhoneNumberGeocodingMetaData",
            ],
            path: "libPhoneNumberGeocoding",
            exclude: [
                "README.md",
                "Info.plist",
            ],
            publicHeadersPath: "."
        ),
        .testTarget(
            name: "libPhoneNumberGeocodingTests",
            dependencies: [
                "libPhoneNumberGeocoding",
                "libPhoneNumberTestsCommon",
            ],
            path: "libPhoneNumberGeocodingTests",
            resources: [
                .copy("TestingSource.bundle")
            ]
        ),
        .target(
            name: "libPhoneNumberShortNumberInternal",
            dependencies: [
                "libPhoneNumber",
            ],
            path: "libPhoneNumberShortNumberInternal",
            publicHeadersPath: "."
        ),
        .target(
            name: "libPhoneNumberShortNumber",
            dependencies: [
                "libPhoneNumberShortNumberInternal",
            ],
            path: "libPhoneNumberShortNumber",
            exclude: [
                "README.md",
                "Info.plist",
            ],
            publicHeadersPath: "."
        ),
        .testTarget(
            name: "libPhoneNumberShortNumberTests",
            dependencies: [
                "libPhoneNumberShortNumber",
                "libPhoneNumberTestsCommon",
            ],
            path: "libPhoneNumberShortNumberTests"
        ),
        .target(
            name: "libPhoneNumberCarrierMetaData",
            path: "libPhoneNumberCarrierMetaData",
            resources: [
                .copy("CarrierMetaData.bundle")
            ],
            publicHeadersPath: "."
        ),
        .target(
            name: "libPhoneNumberCarrier",
            dependencies: [
                "libPhoneNumber",
                "libPhoneNumberCarrierMetaData",
            ],
            path: "libPhoneNumberCarrier",
            exclude: [
                "Info.plist",
            ],
            publicHeadersPath: "."
        ),
        .testTarget(
            name: "libPhoneNumberCarrierTests",
            dependencies: [
                "libPhoneNumberCarrier",
            ],
            path: "libPhoneNumberCarrierTests"
        ),
        .target(
            name: "libPhoneNumberTimeZonesMetaData",
            path: "libPhoneNumberTimeZonesMetaData",
            resources: [
                .copy("TimeZonesMetaData.bundle")
            ],
            publicHeadersPath: "."
        ),
        .target(
            name: "libPhoneNumberTimeZones",
            dependencies: [
                "libPhoneNumber",
                "libPhoneNumberTimeZonesMetaData",
            ],
            path: "libPhoneNumberTimeZones",
            exclude: [
                "Info.plist",
            ],
            publicHeadersPath: "."
        ),
        .testTarget(
            name: "libPhoneNumberTimeZonesTests",
            dependencies: [
                "libPhoneNumberTimeZones",
            ],
            path: "libPhoneNumberTimeZonesTests"
        ),
        .target(
            name: "libPhoneNumberSwiftCore",
            dependencies: [
                "libPhoneNumber",
            ],
            path: "libPhoneNumberSwiftCore"
        ),
        .target(
            name: "libPhoneNumberSwiftGeocoding",
            dependencies: [
                "libPhoneNumberSwiftCore",
                "libPhoneNumberGeocoding",
            ],
            path: "libPhoneNumberSwiftGeocoding"
        ),
        .target(
            name: "libPhoneNumberSwiftShortNumber",
            dependencies: [
                "libPhoneNumberSwiftCore",
                "libPhoneNumberShortNumber",
            ],
            path: "libPhoneNumberSwiftShortNumber"
        ),
        .target(
            name: "libPhoneNumberSwiftCarrier",
            dependencies: [
                "libPhoneNumberSwiftCore",
                "libPhoneNumberCarrier",
            ],
            path: "libPhoneNumberSwiftCarrier"
        ),
        .target(
            name: "libPhoneNumberSwiftTimeZones",
            dependencies: [
                "libPhoneNumberSwiftCore",
                "libPhoneNumberTimeZones",
            ],
            path: "libPhoneNumberSwiftTimeZones"
        ),
        .target(
            name: "libPhoneNumberIOSSwift",
            dependencies: [
                "libPhoneNumberSwiftCore",
                "libPhoneNumberSwiftGeocoding",
                "libPhoneNumberSwiftShortNumber",
            ],
            path: "libPhoneNumberIOSSwift"
        ),
        .target(
            name: "libPhoneNumberSwiftUI",
            dependencies: [
                "libPhoneNumberSwiftCore",
            ],
            path: "libPhoneNumberSwiftUI"
        ),
        .target(
            name: "libPhoneNumberSwiftUIEnrichment",
            dependencies: [
                "libPhoneNumberSwiftUI",
                "libPhoneNumberSwiftCarrier",
                "libPhoneNumberSwiftTimeZones",
            ],
            path: "libPhoneNumberSwiftUIEnrichment"
        ),
        .testTarget(
            name: "libPhoneNumberSwiftCoreTests",
            dependencies: [
                "libPhoneNumberSwiftCore",
                // Needed by the enum bridging tests, which compare the Swift
                // facade's raw values against the Objective-C constants.
                "libPhoneNumber",
            ],
            path: "libPhoneNumberSwiftCoreTests"
        ),
        .testTarget(
            name: "libPhoneNumberSwiftGeocodingTests",
            dependencies: [
                "libPhoneNumberSwiftCore",
                "libPhoneNumberSwiftGeocoding",
            ],
            path: "libPhoneNumberSwiftGeocodingTests"
        ),
        .testTarget(
            name: "libPhoneNumberSwiftShortNumberTests",
            dependencies: [
                "libPhoneNumberSwiftCore",
                "libPhoneNumberSwiftShortNumber",
                // Needed by the enum bridging test.
                "libPhoneNumberShortNumber",
            ],
            path: "libPhoneNumberSwiftShortNumberTests"
        ),
        .testTarget(
            name: "libP
```

### Core Architecture Module: `libPhoneNumber-Demo/libPhoneNumber-Demo/AppDelegate.swift`
```
//
//  AppDelegate.swift
//  libPhoneNumber-Demo
//
//  Created by Rastaar Haghi on 7/17/20.
//  Copyright © 2020 Google LLC. All rights reserved.
//

import UIKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // Override point for customization after application launch.
    return true
  }

  // MARK: UISceneSession Lifecycle

  func application(
    _ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    // Called when a new scene session is being created.
    // Use this method to select a configuration to create the new scene with.
    return UISceneConfiguration(
      name: "Default Configuration", sessionRole: connectingSceneSession.role)
  }

  func application(
    _ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>
  ) {
    // Called when the user discards a scene session.
    // If any sessions were discarded while the application was not running, this will be called shortly after application:didFinishLaunchingWithOptions.
    // Use this method to release any resources that were specific to the discarded scenes, as they will not return.
  }
}

```

### Core Architecture Module: `libPhoneNumber-Demo/libPhoneNumber-Demo/FormatterView.swift`
```
//
//  FormatterView.swift
//  libPhoneNumber-Demo
//
//  Created by Rastaar Haghi on 7/17/20.
//  Copyright © 2020 Google LLC. All rights reserved.
//

import SwiftUI

#if canImport(libPhoneNumber)
import libPhoneNumber
#elseif canImport(libPhoneNumber_iOS)
import libPhoneNumber_iOS
#endif

struct FormatterView: View {
  @State var phoneNumber: String = ""
  let formatter: NBAsYouTypeFormatter = NBAsYouTypeFormatter(regionCode: Locale.current.regionCode)

  var body: some View {
    VStack {
      Form {
        Section(header: Text("Phone Number")) {
          TextField("Ex: 19091234567", text: $phoneNumber)
            .textFieldStyle(RoundedBorderTextFieldStyle())
            .font(.largeTitle)
            .padding()
        }
        .padding()
        Section(header: Text("Formatted Phone Number")) {
          Text(formatPhoneNumber(phoneNumber: phoneNumber))
        }
      }
    }
    .navigationBarTitle("As-You-Type Formatter")
    .lineLimit(2)
    .multilineTextAlignment(.center)
  }

  func formatPhoneNumber(phoneNumber: String) -> String {
    formatter.clear()
    return formatter.inputString(phoneNumber)
  }
}

struct FormatterView_Previews: PreviewProvider {
  static var previews: some View {
    FormatterView()
  }
}

```

### Core Architecture Module: `libPhoneNumber-Demo/libPhoneNumber-Demo/GeocodingSearchView.swift`
```
//
//  GeocodingSearchView.swift
//  libPhoneNumber-Demo
//
//  Created by Rastaar Haghi on 7/17/20.
//  Copyright © 2020 Google LLC. All rights reserved.
//

import SwiftUI
import libPhoneNumberGeocoding

#if canImport(libPhoneNumber)
import libPhoneNumber
#elseif canImport(libPhoneNumber_iOS)
import libPhoneNumber_iOS
#endif

struct GeocodingSearchView: View {
  @State private var localeSelection = 0
  @State private var phoneNumber: String = ""
  @State private var regionDescription: String = ""

  private let geocoder: NBPhoneNumberOfflineGeocoder = NBPhoneNumberOfflineGeocoder()

  var body: some View {
    VStack {
      Form {
        Section(header: Text("Locale Options")) {
          Picker("Locale Options", selection: $localeSelection) {
            ForEach(locales.indices, id: \.self) { index in
              Text(locales[index].language)
                .tag(index)
            }
          }
        }
        Section(header: Text("Phone Number")) {
          TextField("Ex: 19098611234", text: $phoneNumber)
            .textFieldStyle(RoundedBorderTextFieldStyle())
            .padding()
        }
        Button(
          action: {
            self.regionDescription = self.searchPhoneNumber()
          },
          label: {
            Text("Search for Region Description")
              .multilineTextAlignment(.center)
          })
      }
      Text(regionDescription)
        .bold()
    }
    .navigationBarTitle(Text("Search for Region Description"))
  }
}

extension GeocodingSearchView {
  func searchPhoneNumber() -> String {
    do {
      let parsedPhoneNumber: NBPhoneNumber =
        try NBPhoneNumberUtil.sharedInstance().parse(phoneNumber, defaultRegion: Locale.current.regionCode!)
      if localeSelection == 0 {
        return geocoder.description(for: parsedPhoneNumber) ?? "Unknown Region"
      } else {
        return geocoder.description(
          for: parsedPhoneNumber,
          withLanguageCode: locales[localeSelection].localeCode)
          ?? "Unknown Region"
      }
    } catch {
      print(error)
      return "Error parsing phone number."
    }
  }
}

struct GeocodingSearchView_Previews: PreviewProvider {
  static var previews: some View {
    GeocodingSearchView()
  }
}

```

### Core Architecture Module: `libPhoneNumber-Demo/libPhoneNumber-Demo/GeocodingTableView.swift`
```
//
//  GeocodingTableView.swift
//  libPhoneNumber-Demo
//
//  Created by Rastaar Haghi on 7/17/20.
//  Copyright © 2020 Google LLC. All rights reserved.
//

import SwiftUI
import libPhoneNumberGeocoding

#if canImport(libPhoneNumber)
import libPhoneNumber
#elseif canImport(libPhoneNumber_iOS)
import libPhoneNumber_iOS
#endif

struct GeocodingTableView: View {
  // Keep track of runtime statistics
  var maxRuntime: CGFloat = 0.00
  var minRuntime: CGFloat = 0.00
  var totalRuntime: CGFloat = 0.00
  var averageRuntime: CGFloat = 0.00

  init() {
    for _ in 1...50 {
      makeGeocodingAPICalls()
    }

    self.maxRuntime = runtimeArray.max() ?? 0.0
    self.minRuntime = runtimeArray.min() ?? 0.0
    self.totalRuntime = 0.00
    for i in 0..<500 {
      totalRuntime += runtimeArray[i]
      runtimeArray[i] = runtimeArray[i] / maxRuntime
    }
    self.averageRuntime = totalRuntime / CGFloat(runtimeArray.count)
  }

  var body: some View {
    VStack {
      Form {
        Section(header: Text("This table makes 500 Geocoding API calls")) {
          List {
            ForEach(regionDescriptions, id: \.self) { pair in
              HStack {
                Text(pair[0]!)
                Spacer()
                Text(pair[1]!)
              }
            }
          }
        }
      }
      Form {
        Section(header: Text("Runtime Performance for Geocoding API Calls")) {
          LineGraph(dataPoints: runtimeArray)
            .stroke(Color.green, lineWidth: 2)
            .aspectRatio(16 / 9, contentMode: .fit)
            .border(Color.gray, width: 1)
            .padding()
        }
        Section(header: Text("Statistics for Runtime Performance (in milliseconds)")) {
          List {
            Text("Average API Call Runtime: \(round(averageRuntime).description)")
            Text("Longest API Call Runtime: \(round(maxRuntime).description)")
            Text("Shortest API Call Runtime: \(round(minRuntime).description)")
            Text("Total Runtime: \(round(totalRuntime).description)")
          }
        }
      }
    }
    .navigationBarTitle("Large Set of Geocoding Calls")
  }
}

struct GeocodingTableView_Previews: PreviewProvider {
  static var previews: some View {
    GeocodingTableView()
  }
}

extension GeocodingTableView {
  // Fetch Geocoding info for each number in phoneNumbers
  func makeGeocodingAPICalls() {
    for phoneNumber in phoneNumbers {
      do {
        let startTimer = DispatchTime.now()
        let parsedPhoneNumber = try NBPhoneNumberUtil.sharedInstance().parse(phoneNumber, defaultRegion: "US")
        regionDescriptions.append([
          phoneNumber,
          geocoder.description(for: parsedPhoneNumber),
        ])
        let endTimer = DispatchTime.now()
        let runtimeData = CGFloat(endTimer.uptimeNanoseconds - startTimer.uptimeNanoseconds)
        runtimeArray.append(runtimeData / 1000000.0)
      } catch {
        print(error)
      }
    }
  }

  // Graph Design based from: https://www.objc.io/blog/2020/03/16/swiftui-line-graph-animation/
  struct LineGraph: Shape {
    var dataPoints: [CGFloat]

    func path(in rect: CGRect) -> Path {
      func point(at ix: Int) -> CGPoint {
        let point = dataPoints[ix]
        let x = rect.width * CGFloat(ix) / CGFloat(dataPoints.count - 1)
        let y = (1 - point) * rect.height
        return CGPoint(x: x, y: y)
      }

      return Path { p in
        guard dataPoints.count > 1 else { return }
        let start = dataPoints[0]
        p.move(to: CGPoint(x: 0, y: (1 - start) * rect.height))
        for idx in dataPoints.indices {
          p.addLine(to: point(at: idx))
        }
      }
    }
  }
}

let phoneNumbers: [String] = [
  "19098611234",
  "14159601234",
  "12014321234",
  "12034811234",
  "12067061234",
  "12077711234",
  "12144681234",
  "12158231234",
  "12394351234",
  "12534591234",
]

private var geocoder: NBPhoneNumberOfflineGeocoder = NBPhoneNumberOfflineGeocoder()
var regionDescriptions: [[String?]] = []
var runtimeArray: [CGFloat] = []

```

### Core Architecture Module: `libPhoneNumber-Demo/libPhoneNumber-Demo/GeocodingView.swift`
```
//
//  GeocodingView.swift
//  libPhoneNumber-Demo
//
//  Created by Rastaar Haghi on 7/17/20.
//  Copyright © 2020 Google LLC. All rights reserved.
//

import SwiftUI

struct GeocodingView: View {
  var body: some View {
    List {
      NavigationLink(destination: GeocodingTableView()) {
        Text("Table of Region Descriptions")
      }
      NavigationLink(destination: GeocodingSearchView()) {
        Text("Search for a phone number")
      }
    }
    .navigationBarTitle("Geocoding", displayMode: .inline)
  }
}

struct GeocodingView_Previews: PreviewProvider {
  static var previews: some View {
    GeocodingView()
  }
}

```

### Core Architecture Module: `libPhoneNumber-Demo/libPhoneNumber-Demo/Locales.swift`
```
//
//  Locales.swift
//  libPhoneNumber-Demo
//
//  Created by Rastaar Haghi on 7/20/20.
//  Copyright © 2020 Google LLC. All rights reserved.
//

import Foundation
import libPhoneNumberShortNumber

struct LocaleInfo {
  let localeCode: String
  let language: String
}

// These are all of the languages supported by libPhoneNumber.
let locales: [LocaleInfo] = [
  LocaleInfo(localeCode: "Default Device Language", language: "Default Device Language"),
  LocaleInfo(localeCode: "ar", language: "Arabic"),
  LocaleInfo(localeCode: "be", language: "Belarusian"),
  LocaleInfo(localeCode: "bg", language: "Bulgarian"),
  LocaleInfo(localeCode: "bs", language: "Bosnian"),
  LocaleInfo(localeCode: "de", language: "German"),
  LocaleInfo(localeCode: "el", language: "Greek"),
  LocaleInfo(localeCode: "en", language: "English"),
  LocaleInfo(localeCode: "es", language: "Spanish"),
  LocaleInfo(localeCode: "fa", language: "Persian"),
  LocaleInfo(localeCode: "fi", language: "Finnish"),
  LocaleInfo(localeCode: "fr", language: "French"),
  LocaleInfo(localeCode: "hr", language: "Croatian"),
  LocaleInfo(localeCode: "hu", language: "Hungarian"),
  LocaleInfo(localeCode: "hy", language: "Armenian"),
  LocaleInfo(localeCode: "id", language: "Indonesian"),
  LocaleInfo(localeCode: "it", language: "Italian"),
  LocaleInfo(localeCode: "iw", language: "Hebrew"),
  LocaleInfo(localeCode: "ja", language: "Japanese"),
  LocaleInfo(localeCode: "ko", language: "Korean"),
  LocaleInfo(localeCode: "nl", language: "Dutch"),
  LocaleInfo(localeCode: "pl", language: "Polish"),
  LocaleInfo(localeCode: "pt", language: "Portuguese"),
  LocaleInfo(localeCode: "ro", language: "Romanian"),
  LocaleInfo(localeCode: "ru", language: "Russian"),
  LocaleInfo(localeCode: "sq", language: "Albanian"),
  LocaleInfo(localeCode: "sr", language: "Serbian"),
  LocaleInfo(localeCode: "sv", language: "Swedish"),
  LocaleInfo(localeCode: "th", language: "Thai"),
  LocaleInfo(localeCode: "tr", language: "Turkish"),
  LocaleInfo(localeCode: "uk", language: "Ukrainian"),
  LocaleInfo(localeCode: "vi", language: "Vietnamese"),
  LocaleInfo(localeCode: "zh", language: "Chinese"),
  LocaleInfo(localeCode: "zh_Hant", language: "Chinese (Traditional)"),
]

// These are all of the formatting options supported by libPhoneNumber.
let formatOptions = [
  "Select a phone number format", "E164", "INTERNATIONAL", "NATIONAL", "RFC3966",
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #52** (2015-03-02): **SIGABRT in 0.8.3**
  *Symptoms*: Got a sigabrt after updating to the latest cocoapod. Not sure if this is something wrong on my end, but I'm just calling parse using the (now deprecated) singleton number formatter  Thread : Crashed: com.apple.root.default-priority 0  libsystem_kernel.dylib         0x0000000191b2658c __pthread_kill + 8 1  libsystem_pthread.dylib        0x0000000191ba916c pthread_kill + 104 2  libsystem_c.dylib              0x0000000191aba808 abort + 112 3  libsystem_malloc.dylib         0x0000000191b605c4 _nano_malloc_check_clear 4  libsystem_malloc.dylib         0x0000000191b5f548 nano_free + 252 5  CoreFoundation                 0x0000000184f02ad8 __CFStringDeallocate + 192 6  CoreFoundation                 0x0000000184e29f8c CFRelease + 316 7  App                          0x000000010058ce64 +[NBMetadataHelper getMetadataForRegion:](NBMetadataHelper.m:228) 8  App                          0x0000000100598b94 -[NBPhoneNumberUtil isValidRegionCode:](NBPhoneNumberUtil.m:993) 9  App                          0x00000001005a4830 -[NBPhoneNumberUtil checkRegionForParsing:defaultRegion:](NBPhoneNumberUtil.m:3235) 10 App                          0x00000001005a54a0 -[NBPhoneNumberUtil parseHelper:defaultRegion:keepRawInput:checkRegion:error:](NBPhoneNumberUtil.m:3414) 11 App                          0x00000001005a4998 -[NBPhoneNumberUtil parse:defaultRegion:error:](NBPhoneNumberUtil.m:3265) 
  **Post-Mortem & Fix Analysis**:
  > Please test with latest commit. I was removed static methods (metadata) temporarily. And please tell me your result. 
  > I will release 0.8.4 if it has no issue. (waiting your result) 
  > I'm not able to reproduce the crash with the latest commit, so looks good. Thanks for the quick response! 

- **Issue #51** (2015-03-03): **concurrency issue**
  *Symptoms*: Hi I am using latest source from this repository.  I am still facing concurrency issues than https://github.com/me2day/libPhoneNumber-iOS/issues/39 Using multiple threads using different instances of nbphonenumberutil Any test I could do to help solve ?  regards  ferreol 
  **Post-Mortem & Fix Analysis**:
  > Please test with latest commit. I was removed static methods (metadata) temporarily. And please tell me your result. 
  > I will release 0.8.4 if it has no issue. (waiting your result) 
  > Hi iziz,  thank you so much for your quick fix. So far this has fixed the issue that I had noticed at launch time (while loading contacts phone numbers in a background thread).  Let's consider it fixed, I would re comment if after some more extensive testing it reappears.  

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

### Incident Patch 1: `c5029791` (2026-09-12)
**Commit Message**: Merge pull request #454 from iziz/revert-breaking-changes

Remove the breaking changes so the next release can be 2.1.0

**File**: `CHANGELOG.md` (modified, +9/-8)
```diff
@@ -9,8 +9,12 @@ as described in `docs/RELEASE_RUNBOOK.md`.
 
 ## Unreleased
 
-This release carries breaking API changes and must be published as a major
-version.
+Additive. No public API is removed or changed, so this is a minor release.
+
+The one compatibility note is the toolchain: the Swift package now requires
+Swift 6 tools, so Swift Package Manager consumers need Xcode 16 or later.
+Deployment targets are unchanged, and the CocoaPods specs accept Swift 5.9 or
+6.0.
 
 ### Fixed
 
@@ -42,6 +46,9 @@ version.
   podspec sets `visionos.deployment_target`, and CI builds every product for it.
 - All Swift facade entry points are `Sendable`, so `PhoneNumberUtility.shared`
   and its siblings can be used from Swift 6 code without a concurrency error.
+  `PhoneNumberFieldState` stays non-`Sendable` because it carries the error
+  raised by the Objective-C core, whose domain and code callers rely on; use
+  `PhoneNumberValue` for state that leaves the field's concurrency domain.
   The conformances are `@unchecked` and documented against the Objective-C
   core's locking, and the concurrency test suite exercises the shared instances
   from many tasks at once under the thread sanitizer.
@@ -61,12 +68,6 @@ version.
 
 - The package requires Swift 6 tools (`swift-tools-version:6.0`) and builds in
   the Swift 6 language mode. Podspecs accept Swift 5.9 or 6.0.
-- **Breaking.** `PhoneNumberFieldState.error` is a `PhoneNumberValueError?`
-  rather than an existential `Error?`. The state is now `Sendable` and its
-  `Equatable` conformance is synthesized instead of comparing error descriptions.
-  Code that reads `state.error` as an `NSError` needs to switch over the enum.
-- **Breaking.** `PhoneNumberEnriching` requires `Sendable`. Existing conformances
-  compile unchanged unless they capture non-`Sendable` state.
 - `PhoneNumberUtility.phoneNumber(from:)` reports failures through
   `PhoneNumberValueError(_:)`, consistent with the other `Result`-returning APIs.
 - The regular-expression cache compiles patterns outside its lock, so a cache hit
```

**File**: `libPhoneNumberSwiftUI/PhoneNumberTextField.swift` (modified, +18/-10)
```diff
@@ -5,11 +5,7 @@ import UIKit
 #endif
 
 /// The result of parsing the field's current text.
-///
-/// `error` is a concrete ``PhoneNumberValueError`` rather than an existential
-/// `Error` so the state can be compared, sent across concurrency domains, and
-/// switched over by callers.
-public struct PhoneNumberFieldState: Equatable, Sendable {
+public struct PhoneNumberFieldState: Equatable {
     public let text: String
     public let e164: String?
     public let regionCode: String?
@@ -18,7 +14,7 @@ public struct PhoneNumberFieldState: Equatable, Sendable {
     public let enrichment: PhoneNumberEnrichment?
     public let isPossible: Bool
     public let isValid: Bool
-    public let error: PhoneNumberValueError?
+    public let error: Error?
 
     public init(
         text: String,
@@ -29,7 +25,7 @@ public struct PhoneNumberFieldState: Equatable, Sendable {
         enrichment: PhoneNumberEnrichment?,
         isPossible: Bool,
         isValid: Bool,
-        error: PhoneNumberValueError?
+        error: Error?
     ) {
         self.text = text
         self.e164 = e164
@@ -41,6 +37,18 @@ public struct PhoneNumberFieldState: Equatable, Sendable {
         self.isValid = isValid
         self.error = error
     }
+
+    public static func == (lhs: PhoneNumberFieldState, rhs: PhoneNumberFieldState) -> Bool {
+        lhs.text == rhs.text &&
+        lhs.e164 == rhs.e164 &&
+        lhs.regionCode == rhs.regionCode &&
+        lhs.type == rhs.type &&
+        lhs.validationResult == rhs.validationResult &&
+        lhs.enrichment == rhs.enrichment &&
+        lhs.isPossible == rhs.isPossible &&
+        lhs.isValid == rhs.isValid &&
+        String(describing: lhs.error) == String(describing: rhs.error)
+    }
 }
 
 public struct PhoneNumberEnrichment: Equatable, Sendable {
@@ -53,7 +61,7 @@ public struct PhoneNumberEnrichment: Equatable, Sendable {
     }
 }
 
-public protocol PhoneNumberEnriching: Sendable {
+public protocol PhoneNumberEnriching {
     func enrichment(for number: PhoneNumber, regionCode: String?) -> PhoneNumberEnrichment
 }
 
@@ -87,7 +95,7 @@ public struct PhoneNumberFieldStyle: Sendable {
     public static let automatic = PhoneNumberFieldStyle()
 }
 
-public struct PhoneNumberFieldFormatter: Sendable {
+public struct PhoneNumberFieldFormatter {
     private let utility: PhoneNumberUtility
     private let enricher: PhoneNumberEnriching?
 
@@ -135,7 +143,7 @@ public struct PhoneNumberFieldFormatter: Sendable {
                 enrichment: nil,
                 isPossible: false,
                 isValid: false,
-                error: PhoneNumberValueError(error)
+                error: error
             )
         }
     }
```

**File**: `libPhoneNumberSwiftUITests/PhoneNumberFieldStateTests.swift` (modified, +20/-12)
```diff
@@ -1,3 +1,4 @@
+import Foundation
 import Testing
 import libPhoneNumberSwiftCore
 import libPhoneNumberSwiftUI
@@ -19,18 +20,18 @@ struct PhoneNumberFieldStateTests {
         #expect(state.error == nil)
     }
 
-    /// The state carries a concrete error, so callers can switch over it and
-    /// compare two states for equality.
-    @Test("An unparseable entry reports a typed error")
-    func typedError() {
+    /// The state carries the error raised by the Objective-C core, so callers
+    /// keep access to its domain and code.
+    @Test("An unparseable entry reports the underlying error")
+    func underlyingError() {
         let state = formatter.state(for: "abc", defaultRegion: "US")
 
         #expect(state.e164 == nil)
         #expect(!state.isValid)
-        guard case .underlying = state.error else {
-            Issue.record("Expected .underlying, got \(String(describing: state.error))")
-            return
-        }
+
+        let error = state.error as NSError?
+        #expect(error != nil)
+        #expect(error?.localizedDescription.isEmpty == false)
     }
 
     @Test("States compare equal when their contents match")
@@ -55,12 +56,19 @@ struct PhoneNumberFieldStateTests {
         #expect(formatter.formattedText(for: "6502530000", defaultRegion: "US") == "(650) 253-0000")
     }
 
-    @Test("Field state crosses concurrency domains")
-    func stateIsSendable() async {
+    /// PhoneNumberFieldState holds an existential Error and is deliberately not
+    /// Sendable. Use PhoneNumberValue, which is, for anything that leaves the
+    /// field's concurrency domain.
+    @Test("The value derived from a state crosses concurrency domains")
+    func valueIsSendable() async throws {
         let state = formatter.state(for: "6502530000", defaultRegion: "US")
+        let e164 = try #require(state.e164)
+        let value = try PhoneNumberUtility.shared
+            .value(from: e164, defaultRegion: state.regionCode)
+            .get()
 
-        let echoed = await Task { state }.value
+        let echoed = await Task { value }.value
 
-        #expect(echoed == state)
+        #expect(echoed == value)
     }
 }
```

---

### Incident Patch 2: `ef377848` (2026-09-12)
**Commit Message**: refactor(swiftui): keep the field state's public API source-compatible

The Swift 6 work changed two things in the SwiftUI module that Swift 6
adoption did not require. Both were breaking, and together they forced a
major release days after 2.0.0 shipped.

PhoneNumberFieldState.error was narrowed from an existential Error to a
PhoneNumberValueError. That made the state Sendable and its Equatable
conformance synthesized, but it also discarded information: callers
previously received the NSError raised by the Objective-C core and could
read its domain, code, and userInfo, where the enum preserves only a
description string. Restore the existential, and with it the custom
equality that compares error descriptions.

PhoneNumberEnriching gained a Sendable requirement, which invalidates any
conformance capturing non-Sendable state. Drop it, along with the
conformance it enabled on PhoneNumberFieldFormatter.

None of this was load-bearing. The six statics that were errors in the
Swift 6 language mode -- the five facade shared instances and
PhoneNumberFieldStyle.automatic -- are all fixed by purely additive
Sendable conformances, which stay. The package still builds clean in the
Swift 6 lan

**File**: `CHANGELOG.md` (modified, +9/-8)
```diff
@@ -9,8 +9,12 @@ as described in `docs/RELEASE_RUNBOOK.md`.
 
 ## Unreleased
 
-This release carries breaking API changes and must be published as a major
-version.
+Additive. No public API is removed or changed, so this is a minor release.
+
+The one compatibility note is the toolchain: the Swift package now requires
+Swift 6 tools, so Swift Package Manager consumers need Xcode 16 or later.
+Deployment targets are unchanged, and the CocoaPods specs accept Swift 5.9 or
+6.0.
 
 ### Fixed
 
@@ -42,6 +46,9 @@ version.
   podspec sets `visionos.deployment_target`, and CI builds every product for it.
 - All Swift facade entry points are `Sendable`, so `PhoneNumberUtility.shared`
   and its siblings can be used from Swift 6 code without a concurrency error.
+  `PhoneNumberFieldState` stays non-`Sendable` because it carries the error
+  raised by the Objective-C core, whose domain and code callers rely on; use
+  `PhoneNumberValue` for state that leaves the field's concurrency domain.
   The conformances are `@unchecked` and documented against the Objective-C
   core's locking, and the concurrency test suite exercises the shared instances
   from many tasks at once under the thread sanitizer.
@@ -61,12 +68,6 @@ version.
 
 - The package requires Swift 6 tools (`swift-tools-version:6.0`) and builds in
   the Swift 6 language mode. Podspecs accept Swift 5.9 or 6.0.
-- **Breaking.** `PhoneNumberFieldState.error` is a `PhoneNumberValueError?`
-  rather than an existential `Error?`. The state is now `Sendable` and its
-  `Equatable` conformance is synthesized instead of comparing error descriptions.
-  Code that reads `state.error` as an `NSError` needs to switch over the enum.
-- **Breaking.** `PhoneNumberEnriching` requires `Sendable`. Existing conformances
-  compile unchanged unless they capture non-`Sendable` state.
 - `PhoneNumberUtility.phoneNumber(from:)` reports failures through
   `PhoneNumberValueError(_:)`, consistent with the other `Result`-returning APIs.
 - The regular-expression cache compiles patterns outside its lock, so a cache hit
```

**File**: `libPhoneNumberSwiftUI/PhoneNumberTextField.swift` (modified, +18/-10)
```diff
@@ -5,11 +5,7 @@ import UIKit
 #endif
 
 /// The result of parsing the field's current text.
-///
-/// `error` is a concrete ``PhoneNumberValueError`` rather than an existential
-/// `Error` so the state can be compared, sent across concurrency domains, and
-/// switched over by callers.
-public struct PhoneNumberFieldState: Equatable, Sendable {
+public struct PhoneNumberFieldState: Equatable {
     public let text: String
     public let e164: String?
     public let regionCode: String?
@@ -18,7 +14,7 @@ public struct PhoneNumberFieldState: Equatable, Sendable {
     public let enrichment: PhoneNumberEnrichment?
     public let isPossible: Bool
     public let isValid: Bool
-    public let error: PhoneNumberValueError?
+    public let error: Error?
 
     public init(
         text: String,
@@ -29,7 +25,7 @@ public struct PhoneNumberFieldState: Equatable, Sendable {
         enrichment: PhoneNumberEnrichment?,
         isPossible: Bool,
         isValid: Bool,
-        error: PhoneNumberValueError?
+        error: Error?
     ) {
         self.text = text
         self.e164 = e164
@@ -41,6 +37,18 @@ public struct PhoneNumberFieldState: Equatable, Sendable {
         self.isValid = isValid
         self.error = error
     }
+
+    public static func == (lhs: PhoneNumberFieldState, rhs: PhoneNumberFieldState) -> Bool {
+        lhs.text == rhs.text &&
+        lhs.e164 == rhs.e164 &&
+        lhs.regionCode == rhs.regionCode &&
+        lhs.type == rhs.type &&
+        lhs.validationResult == rhs.validationResult &&
+        lhs.enrichment == rhs.enrichment &&
+        lhs.isPossible == rhs.isPossible &&
+        lhs.isValid == rhs.isValid &&
+        String(describing: lhs.error) == String(describing: rhs.error)
+    }
 }
 
 public struct PhoneNumberEnrichment: Equatable, Sendable {
@@ -53,7 +61,7 @@ public struct PhoneNumberEnrichment: Equatable, Sendable {
     }
 }
 
-public protocol PhoneNumberEnriching: Sendable {
+public protocol PhoneNumberEnriching {
     func enrichment(for number: PhoneNumber, regionCode: String?) -> PhoneNumberEnrichment
 }
 
@@ -87,7 +95,7 @@ public struct PhoneNumberFieldStyle: Sendable {
     public static let automatic = PhoneNumberFieldStyle()
 }
 
-public struct PhoneNumberFieldFormatter: Sendable {
+public struct PhoneNumberFieldFormatter {
     private let utility: PhoneNumberUtility
     private let enricher: PhoneNumberEnriching?
 
@@ -135,7 +143,7 @@ public struct PhoneNumberFieldFormatter: Sendable {
                 enrichment: nil,
                 isPossible: false,
                 isValid: false,
-                error: PhoneNumberValueError(error)
+                error: error
             )
         }
     }
```

**File**: `libPhoneNumberSwiftUITests/PhoneNumberFieldStateTests.swift` (modified, +20/-12)
```diff
@@ -1,3 +1,4 @@
+import Foundation
 import Testing
 import libPhoneNumberSwiftCore
 import libPhoneNumberSwiftUI
@@ -19,18 +20,18 @@ struct PhoneNumberFieldStateTests {
         #expect(state.error == nil)
     }
 
-    /// The state carries a concrete error, so callers can switch over it and
-    /// compare two states for equality.
-    @Test("An unparseable entry reports a typed error")
-    func typedError() {
+    /// The state carries the error raised by the Objective-C core, so callers
+    /// keep access to its domain and code.
+    @Test("An unparseable entry reports the underlying error")
+    func underlyingError() {
         let state = formatter.state(for: "abc", defaultRegion: "US")
 
         #expect(state.e164 == nil)
         #expect(!state.isValid)
-        guard case .underlying = state.error else {
-            Issue.record("Expected .underlying, got \(String(describing: state.error))")
-            return
-        }
+
+        let error = state.error as NSError?
+        #expect(error != nil)
+        #expect(error?.localizedDescription.isEmpty == false)
     }
 
     @Test("States compare equal when their contents match")
@@ -55,12 +56,19 @@ struct PhoneNumberFieldStateTests {
         #expect(formatter.formattedText(for: "6502530000", defaultRegion: "US") == "(650) 253-0000")
     }
 
-    @Test("Field state crosses concurrency domains")
-    func stateIsSendable() async {
+    /// PhoneNumberFieldState holds an existential Error and is deliberately not
+    /// Sendable. Use PhoneNumberValue, which is, for anything that leaves the
+    /// field's concurrency domain.
+    @Test("The value derived from a state crosses concurrency domains")
+    func valueIsSendable() async throws {
         let state = formatter.state(for: "6502530000", defaultRegion: "US")
+        let e164 = try #require(state.e164)
+        let value = try PhoneNumberUtility.shared
+            .value(from: e164, defaultRegion: state.regionCode)
+            .get()
 
-        let echoed = await Task { state }.value
+        let echoed = await Task { value }.value
 
-        #expect(echoed == state)
+        #expect(echoed == value)
     }
 }
```

---

### Incident Patch 3: `8813ea1b` (2026-09-12)
**Commit Message**: Merge pull request #452 from iziz/swift6-concurrency-and-geocoding-fixes

Fix geocoding metadata resolution and adopt Swift 6 concurrency

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+name: Bug report
+description: A number is parsed, formatted, validated, or described incorrectly, or an API misbehaves.
+labels: ["bug"]
+body:
+  - type: markdown
+    attributes:
+      value: |
+        This library ports Google's libphonenumber. If Google's own
+        implementation agrees with the behavior you are seeing, the change
+        belongs upstream rather than here — please say so below and link it.
+
+  - type: input
+    id: number
+    attributes:
+      label: Phone number
+      description: >
+        The number that reproduces the problem, with its region. Use a test or
+        example number rather than a real person's number where you can.
+      placeholder: "+82 10 6543 1234, default region KR"
+    validations:
+      required: true
+
+  - type: textarea
+    id: expected
+    attributes:
+      label: Expected and actual result
+      description: What you expected each API to return, and what it returned.
+      placeholder: |
+        isValidNumber: expected true, got false
+        format(.e164): expected "+821065431234", got "+8201065431234"
+    validations:
+      required: true
+
+  - type: textarea
+    id: reproduction
+    attributes:
+      label: Reproduction
+      description: The smallest snippet that shows the problem.
+      render: swift
+    validations:
+      required: true
+
+  - type: input
+    id: version
+    attributes:
+      label: Library version
+      placeholder: "2.0.1"
+    validations:
+      required: true
+
+  - type: dropdown
+    id: integration
+    attributes:
+      label: Integration
+      options:
+        - Swift Package Manager
+        - CocoaPods
+        - Carthage
+        - Manual
+    validations:
+      required: true
+
+  - type: input
+    id: module
+    attributes:
+      label: Module
+      description: Which product you imported, for example libPhoneNumberSwiftCore or libPhoneNumberGeocoding.
+      placeholder: libPhoneNumberSwiftCore
+    validations:
+      required: true
+
+  - type: input
+    id: environment
+    attributes:
+      label: Xcode and platform
+      placeholder: "Xcode 27.0, iOS 18.2 simulator"
+    validations:
+      required: true
+
+  - type: textarea
+    id: upstream
+    attributes:
+      label: Upstream comparison
+      description: >
+        Optional but very helpful. What does Google's libphonenumber do with the
+        same number? The demo at https://libphonenumber.appspot.com answers this
+        in a few seconds.
```

**File**: `.github/ISSUE_TEMPLATE/config.yml` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+blank_issues_enabled: true
+contact_links:
+  - name: Upstream libphonenumber behavior
+    url: https://github.com/google/libphonenumber/issues
+    about: Report parsing, formatting, or validation rules that are wrong in Google's library itself, not just in this port.
+  - name: Security vulnerability
+    url: https://github.com/iziz/libPhoneNumber-iOS/security/advisories/new
+    about: Report privately instead of opening an issue.
```

**File**: `.github/ISSUE_TEMPLATE/feature_request.yml` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+name: Feature request
+description: Suggest an API or module addition.
+labels: ["enhancement"]
+body:
+  - type: markdown
+    attributes:
+      value: |
+        Behavior changes to parsing, formatting, or validation belong upstream in
+        Google's libphonenumber. This form is for the Apple-platform surface:
+        Swift APIs, module layout, packaging, and the SwiftUI component.
+
+  - type: textarea
+    id: problem
+    attributes:
+      label: Problem
+      description: What are you trying to do, and what makes it awkward today?
+    validations:
+      required: true
+
+  - type: textarea
+    id: proposal
+    attributes:
+      label: Proposed API
+      description: Sketch the call site you would like to write.
+      render: swift
+
+  - type: textarea
+    id: alternatives
+    attributes:
+      label: What you do instead today
+      description: >
+        Including whether the existing `objc` escape hatch on the facades covers
+        it.
```

**File**: `.github/ISSUE_TEMPLATE/metadata_update.yml` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+name: Metadata or numbering plan issue
+description: A numbering plan changed, or a valid number is rejected because the bundled metadata is out of date.
+labels: ["metadata"]
+body:
+  - type: markdown
+    attributes:
+      value: |
+        Metadata comes from Google's libphonenumber and is refreshed as a whole
+        rather than patched per number. See `docs/METADATA_PATCH_POLICY.md` for
+        when a local override is acceptable.
+
+  - type: input
+    id: number
+    attributes:
+      label: Phone number and region
+      placeholder: "+256 79 412 3456, region UG"
+    validations:
+      required: true
+
+  - type: textarea
+    id: behavior
+    attributes:
+      label: Current and expected classification
+      placeholder: |
+        Current: isValidNumber false, type UNKNOWN
+        Expected: isValidNumber true, type MOBILE
+    validations:
+      required: true
+
+  - type: input
+    id: upstream_ref
+    attributes:
+      label: Upstream reference
+      description: >
+        The Google libphonenumber release or commit that carries the corrected
+        metadata, if you know it.
+      placeholder: "v9.0.38"
+
+  - type: textarea
+    id: source
+    attributes:
+      label: Regulator source
+      description: >
+        A link to the telecom regulator's announcement, if this is a numbering
+        plan change that upstream has not picked up yet.
```

**File**: `.github/pull_request_template.md` (modified, +5/-0)
```diff
@@ -18,11 +18,16 @@
 - [ ] `swift test`
 - [ ] `LC_ALL=ko_KR.UTF-8 LANG=ko_KR.UTF-8 swift test`
 - [ ] `swift build -c release`
+- [ ] `swift test --sanitize=thread` (when shared state or a facade entry point changed)
 - [ ] `xcodebuild test -scheme libPhoneNumber -destination 'id=<simulator-udid>'`
 - [ ] `xcodebuild test -scheme libPhoneNumberGeocoding -destination 'id=<simulator-udid>'`
 - [ ] `xcodebuild test -scheme libPhoneNumberShortNumber -destination 'id=<simulator-udid>'`
 - [ ] `git diff --check`
 
+## Changelog
+
+- [ ] `CHANGELOG.md` updated under `## Unreleased`, or not user-visible
+
 ## Notes
 
 - Intentional ObjC/API naming differences:
```

**File**: `.github/workflows/ci.yml` (modified, +128/-7)
```diff
@@ -82,14 +82,135 @@ jobs:
 
       - name: Lint podspecs
         run: |
+          set -euo pipefail
+          # Every podspec in the repository, so a broken spec cannot ship
+          # unnoticed. The core spec has no internal dependencies to resolve.
           pod lib lint libPhoneNumber-iOS.podspec --allow-warnings
-          pod lib lint libPhoneNumberGeocoding.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumberShortNumber.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumber-iOS-SwiftCore.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumber-iOS-SwiftGeocoding.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumber-iOS-SwiftShortNumber.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumber-iOS-SwiftUI.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumber-iOS-Swift.podspec --allow-warnings --include-podspecs='*.podspec'
+          for podspec in \
+            libPhoneNumberGeocoding.podspec \
+            libPhoneNumberShortNumber.podspec \
+            libPhoneNumberCarrier.podspec \
+            libPhoneNumberTimeZones.podspec \
+            libPhoneNumber-iOS-SwiftCore.podspec \
+            libPhoneNumber-iOS-SwiftGeocoding.podspec \
+            libPhoneNumber-iOS-SwiftShortNumber.podspec \
+            libPhoneNumber-iOS-SwiftCarrier.podspec \
+            libPhoneNumber-iOS-SwiftTimeZones.podspec \
+            libPhoneNumber-iOS-SwiftUI.podspec \
+            libPhoneNumber-iOS-SwiftUIEnrichment.podspec \
+            libPhoneNumber-iOS-Swift.podspec
+          do
+            pod lib lint "$podspec" --allow-warnings --include-podspecs='*.podspec'
+          done
+
+      - name: Check every podspec is linted
+        run: |
+          set -euo pipefail
+          missing=0
+          for podspec in *.podspec; do
+            if ! grep -q "$podspec" .github/workflows/ci.yml; then
+              echo "Podspec not covered by the lint job: $podspec" >&2
+              missing=1
+            fi
+          done
+          exit "$missing"
+
+  platform-builds:
+    name: Build for ${{ matrix.platform }}
+    runs-on: macos-latest
+
+    strategy:
+      fail-fast: false
+      matrix:
+        include:
+          - platform: iOS
+            destination: generic/platform=iOS
+          - platform: tvOS
+            destination: generic/platform=tvOS
+          - platform: watchOS
+            destination: generic/platform=watchOS
+          - platform: visionOS
+            destination: generic/platform=visionOS
+          - platform: macCatalyst
+            destination: platform=macOS,variant=Mac Catalyst
+
+    steps:
+      - name: Check out repository
+        uses: actions/checkout@v7.0.0
+
+      - name: Show Xcode version
+        run: xcodebuild -version
+
+      # xcodebuild resolves libPhoneNumber.xcodeproj rather than Package.swift
+      # when both are in the repository root, and that project carries only the
+      # three Objective-C schemes. Building the package's own schemes requires
+      # the workspace below, so fail with a clear message if it is missing
+      # rather than with "does not contain a scheme named libPhoneNumber-Package".
+      - name: Check the package workspace is present
+        run: |
+          if [ ! -f .swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata ]; then
+            echo "Missing .swiftpm/xcode/package.xcworkspace; see the .swiftpm rules in .gitignore." >&2
+            exit 1
+          fi
+
+      # Package.swift declares macOS, iOS, macCatalyst, tvOS, watchOS and
+      # visionOS. `swift test` only covers macOS, so each of the others is
+      # built here; without this a platform-specific break ships unnoticed.
+      - name: Build all products
+        run: |
+          xcodebuild build \
+            -workspace .swiftpm/xcode/package.xcworkspace \
+            -scheme libPhoneNumber-Package \
+            -destination "${{ matrix.destination }}" \
+            -derivedDataPath "$RUNNER_TEMP/dd-${{ matrix.platform }}"
+
+  thread-sanitizer:
+    name: Thread sanitizer
+    runs-on: macos-latest
+
+    steps:
+      - name: Check out repository
+        uses: actions/checkout@v7.0.0
+
+      # The Swift facades are declared @unchecked Sendable on the strength of
+      # the Objective-C core's internal locking. The concurrency tests exercise
+      # the shared instances from many tasks at once; under TSan they check that
+      # claim instead of merely asserting it.
+      - name: Run SwiftPM tests under the thread sanitizer
+        run: swift test --sanitize=thread
+
+  code-coverage:
+    name: Code coverage
+    runs-on: macos-latest
+
+    steps:
+      - name: Check out repository
+        uses: actions/checkout@v7.0.0
+
+      - name: Run SwiftPM tests with coverage
+        run: 
```

**File**: `.gitignore` (modified, +11/-1)
```diff
@@ -28,4 +28,14 @@ ObjectiveC.gcda
 
 # SPM
 .build
-.swiftpm
+
+# Track only the generated package workspace. xcodebuild picks
+# libPhoneNumber.xcodeproj over Package.swift when both sit in the repository
+# root, so building the package's own schemes needs this file to exist in a
+# fresh checkout. Everything else under .swiftpm is per-user Xcode state.
+.swiftpm/*
+!.swiftpm/xcode/
+.swiftpm/xcode/*
+!.swiftpm/xcode/package.xcworkspace/
+.swiftpm/xcode/package.xcworkspace/*
+!.swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata
```

**File**: `.swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<Workspace
+   version = "1.0">
+   <FileRef
+      location = "self:">
+   </FileRef>
+</Workspace>
```

---

### Incident Patch 4: `25389544` (2026-09-12)
**Commit Message**: Merge pull request #453 from iziz/fix-geocoding-metadata-resolution

Fix geocoding metadata resolution under SwiftPM and per-language statement poisoning

**File**: `README.md` (modified, +4/-0)
```diff
@@ -245,6 +245,10 @@ let number = try phoneUtil.parse("16502530000", defaultRegion: "US")
 let description = geocoder.description(for: number, languageCode: "en")
 ```
 
+Only the English database carries worldwide coverage. The other languages ship
+their own country, so a lookup outside it falls back to the localized country
+name rather than a locality.
+
 ### Carrier
 
 ```swift
```

**File**: `libPhoneNumber/NBMetadataHelper.m` (modified, +13/-1)
```diff
@@ -8,6 +8,8 @@
 
 #import "NBMetadataHelper.h"
 
+#import <os/lock.h>
+
 #import <NBGeneratedPhoneNumberMetaData.h>
 #import "NBPhoneMetaData.h"
 
@@ -34,7 +36,11 @@ @interface NBMetadataHelper ()
 @implementation NBMetadataHelper {
  @private
   NSDictionary *_phoneNumberDataDictionary;
+  // Lazily derived from _phoneNumberDataDictionary. Guarded by
+  // _countryCodeToCountryNumberLock because the helper is shared by the
+  // NBPhoneNumberUtil singleton and can be reached from multiple threads.
   NSDictionary *_countryCodeToCountryNumberDictionary;
+  os_unfair_lock _countryCodeToCountryNumberLock;
 }
 
 - (instancetype)init {
@@ -55,6 +61,7 @@ - (instancetype)initWithZippedDataBytes:(z_const Bytef *)data
   self = [super init];
 
   if (self != nil) {
+    _countryCodeToCountryNumberLock = OS_UNFAIR_LOCK_INIT;
     _metadataCache = [[NSCache alloc] init];
     _metadataMapCache = [[NSCache alloc] init];
     _phoneNumberDataDictionary =
@@ -74,6 +81,8 @@ - (instancetype)initWithZippedDataBytes:(z_const Bytef *)data
  */
 
 - (NSDictionary *)countryCodeToCountryNumberDictionary {
+  os_unfair_lock_lock(&_countryCodeToCountryNumberLock);
+
   if (_countryCodeToCountryNumberDictionary == nil) {
     NSDictionary *countryCodeToRegionCodeMap = [self countryCodeToRegionCodeDictionary];
     NSMutableDictionary *map = [[NSMutableDictionary alloc] init];
@@ -86,7 +95,10 @@ - (NSDictionary *)countryCodeToCountryNumberDictionary {
     _countryCodeToCountryNumberDictionary = [map copy];
   }
 
-  return _countryCodeToCountryNumberDictionary;
+  NSDictionary *result = _countryCodeToCountryNumberDictionary;
+  os_unfair_lock_unlock(&_countryCodeToCountryNumberLock);
+
+  return result;
 }
 
 - (NSDictionary *)countryCodeToRegionCodeDictionary {
```

**File**: `libPhoneNumber/NBRegularExpressionCache.m` (modified, +35/-17)
```diff
@@ -8,13 +8,17 @@
 
 #import "NBRegularExpressionCache.h"
 
+#import <os/lock.h>
+
 @interface NBRegularExpressionCache()
 
 @property (nonatomic, strong) NSCache *cache;
 
 @end
 
-@implementation NBRegularExpressionCache
+@implementation NBRegularExpressionCache {
+  os_unfair_lock _cacheLock;
+}
 
 + (instancetype)sharedInstance {
   static NBRegularExpressionCache *instance;
@@ -29,34 +33,48 @@ + (instancetype)sharedInstance {
 - (instancetype)init {
   self = [super init];
   if (self != nil) {
+    _cacheLock = OS_UNFAIR_LOCK_INIT;
     _cache = [[NSCache alloc] init];
   }
 
   return self;
 }
 
 - (NSRegularExpression *)regularExpressionForPattern:(NSString *)pattern error:(NSError **)error {
-  @synchronized(self) {
-    NSRegularExpression *cachedObject = [self.cache objectForKey:pattern];
-    if (cachedObject != nil) {
-      return cachedObject;
-    }
+  // Cache hits, which are the overwhelmingly common case, only hold the lock
+  // for the lookup itself. Compilation happens outside the lock so concurrent
+  // callers are not serialized behind an unrelated pattern being built. Two
+  // threads racing on the same new pattern may each compile it; the duplicate
+  // is simply discarded by the insertion below.
+  os_unfair_lock_lock(&_cacheLock);
+  NSRegularExpression *cachedObject = [self.cache objectForKey:pattern];
+  os_unfair_lock_unlock(&_cacheLock);
+
+  if (cachedObject != nil) {
+    return cachedObject;
+  }
 
-    NSError *regExError = nil;
-    NSRegularExpression *regEx = [[NSRegularExpression alloc] initWithPattern:pattern
-                                                                      options:kNilOptions
-                                                                        error:&regExError];
-    if (regEx == nil) {
-      if (error != NULL) {
-        *error = regExError;
-      }
-      return nil;
+  NSError *regExError = nil;
+  NSRegularExpression *regEx = [[NSRegularExpression alloc] initWithPattern:pattern
+                                                                    options:kNilOptions
+                                                                      error:&regExError];
+  if (regEx == nil) {
+    if (error != NULL) {
+      *error = regExError;
     }
+    return nil;
+  }
 
+  os_unfair_lock_lock(&_cacheLock);
+  NSRegularExpression *raced = [self.cache objectForKey:pattern];
+  if (raced != nil) {
+    regEx = raced;
+  } else {
     [self.cache setObject:regEx forKey:pattern];
-
-    return regEx;
   }
+  os_unfair_lock_unlock(&_cacheLock);
+
+  return regEx;
 }
 
 @end
```

**File**: `libPhoneNumberGeocoding/NBGeocoderMetaDataHelper.h` (modified, +17/-1)
```diff
@@ -29,10 +29,26 @@ NS_ASSUME_NONNULL_BEGIN
  */
 - (instancetype)initWithCountryCode:(NSNumber *)countryCode
                        withLanguage:(NSString *)languageCode
-                         withBundle:(NSBundle *)bundle;
+                         withBundle:(nullable NSBundle *)bundle;
 
+/**
+ * Initializer that resolves the shipped geocoding databases automatically.
+ *
+ * The payload is located by searching the loaded bundles, which covers
+ * CocoaPods, Carthage, manual integration, and the nested wrapper bundle
+ * SwiftPM generates. A helper created when no payload can be found answers
+ * every query with nil, and the geocoder falls back to country names.
+ */
 - (instancetype)initWithCountryCode:(NSNumber *)countryCode withLanguage:(NSString *)languageCode;
 
+/**
+ * The bundle holding the geocoding databases, or nil when none was found.
+ *
+ * Exposed so integrators can check whether the metadata resolved at all,
+ * instead of silently receiving country-level descriptions.
+ */
++ (nullable NSBundle *)defaultMetadataBundle;
+
 /**
  * Returns a text description for the given phone number. The description will be based on the
  * country code and national number attributes of the NBPhoneNumber parameter. If no result was
```

**File**: `libPhoneNumberGeocoding/NBGeocoderMetaDataHelper.m` (modified, +98/-11)
```diff
@@ -48,6 +48,10 @@ - (instancetype)initWithCountryCode:(NSNumber *)countryCode
     _countryCode = countryCode;
     _language = languageCode;
 
+    if (bundle == nil) {
+      return self;
+    }
+
     NSString *shortLanguageCode = [[languageCode componentsSeparatedByString:@"-"] firstObject];
     NSURL *databaseURL = [[bundle resourceURL]
         URLByAppendingPathComponent:[NSString stringWithFormat:@"%@.db", shortLanguageCode]];
@@ -69,25 +73,108 @@ - (instancetype)initWithCountryCode:(NSNumber *)countryCode
 }
 
 - (instancetype)initWithCountryCode:(NSNumber *)countryCode withLanguage:(NSString *)languageCode {
-  NSBundle *bundle = [NSBundle bundleForClass:self.classForCoder];
-  NSURL *resourceURL =
-      [[bundle resourceURL] URLByAppendingPathComponent:@"GeocodingMetaData.bundle"];
-  NSBundle *databaseBundle = [NSBundle bundleWithURL:resourceURL];
-  return [self initWithCountryCode:countryCode withLanguage:languageCode withBundle:databaseBundle];
+  return [self initWithCountryCode:countryCode
+                      withLanguage:languageCode
+                        withBundle:[NBGeocoderMetaDataHelper defaultMetadataBundle]];
+}
+
+// Locates GeocodingMetaData.bundle wherever the integration put it.
+//
+// Appending the payload to -[NSBundle bundleForClass:].resourceURL only works
+// for CocoaPods and manual integration, where the databases land next to the
+// consuming binary. SwiftPM nests them one level deeper, inside a generated
+// wrapper bundle, and emits that wrapper flat up to Xcode 26 but
+// macOS-structured (Contents/Resources) from Xcode 27. Without this search the
+// databases are simply not found and every lookup falls back to the country
+// name, with no error and no crash.
++ (NSBundle * _Nullable)defaultMetadataBundle {
+  static NSBundle *cachedBundle = nil;
+  static dispatch_once_t onceToken;
+  dispatch_once(&onceToken, ^{
+    NSMutableArray<NSBundle *> *searchBundles = [NSMutableArray arrayWithArray:NSBundle.allBundles];
+    [searchBundles addObjectsFromArray:NSBundle.allFrameworks];
+    [searchBundles addObject:[NSBundle bundleForClass:self]];
+    [searchBundles addObject:[NSBundle mainBundle]];
+
+    for (NSBundle *bundle in searchBundles) {
+      NSMutableArray<NSURL *> *baseURLs = [NSMutableArray array];
+      if (bundle.resourceURL != nil) {
+        [baseURLs addObject:bundle.resourceURL];
+      }
+      if (bundle.bundleURL != nil) {
+        [baseURLs addObject:bundle.bundleURL];
+      }
+
+      NSURL *parentURL = bundle.bundleURL;
+      for (NSUInteger index = 0; index < 5 && parentURL != nil; index++) {
+        parentURL = [parentURL URLByDeletingLastPathComponent];
+        if (parentURL != nil) {
+          [baseURLs addObject:parentURL];
+        }
+      }
+
+      for (NSURL *baseURL in baseURLs) {
+        NSURL *resourcesURL = [baseURL URLByAppendingPathComponent:@"Contents/Resources"];
+        NSURL *wrapperURL = [baseURL
+            URLByAppendingPathComponent:@"libPhoneNumber_libPhoneNumberGeocodingMetaData.bundle"];
+        NSURL *wrapperResourcesURL =
+            [wrapperURL URLByAppendingPathComponent:@"Contents/Resources"];
+        NSArray<NSURL *> *candidateURLs = @[
+          [baseURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+          [resourcesURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+          [wrapperURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+          [wrapperResourcesURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+        ];
+
+        for (NSURL *candidateURL in candidateURLs) {
+          // en.db ships in every build of the payload, so it identifies a
+          // populated bundle rather than an empty directory of the right name.
+          NSURL *databaseURL = [candidateURL URLByAppendingPathComponent:@"en.db"];
+          if ([[NSFileManager defaultManager] fileExistsAtPath:databaseURL.path]) {
+            cachedBundle = [NSBundle bundleWithURL:candidateURL];
+            return;
+          }
+        }
+      }
+    }
+  });
+
+  return cachedBundle;
 }
 
 - (NSString * _Nullable)searchPhoneNumber:(NBPhoneNumber *)phoneNumber {
   @synchronized(self) {
-    if (_database == NULL || _selectStatement == NULL) {
+    if (_database == NULL) {
       return nil;
     }
 
-    if (![phoneNumber.countryCode isEqualToNumber:_countryCode]) {
+    // Each database holds one table per country calling code, and only the
+    // English database covers every country. Preparing a statement for a
+    // country this database does not carry fails, which is an ordinary "no
+    // data for this number" answer -- not a broken helper. Leaving the failed
+    // statement in place used to disable the helper permanently, so a single
+    // lookup for an uncovered country downgraded every later lookup in that
+    // language to a country name.
+    if (_selectStatement == NULL || ![phoneNumber.countryCode isEqualToNumber:_countryCode]) {
       _country
```

**File**: `libPhoneNumberGeocoding/NBPhoneNumberOfflineGeocoder.m` (modified, +21/-5)
```diff
@@ -50,16 +50,32 @@ + (NBPhoneNumberOfflineGeocoder *)sharedInstance {
   return instance;
 }
 
+// Returns the cached helper for |languageCode|, creating it on first use.
+//
+// The lookup and the insertion are performed under a single lock so concurrent
+// callers cannot each open their own SQLite connection for the same language.
+- (NBGeocoderMetaDataHelper *)metadataHelperForLanguageCode:(NSString *)languageCode
+                                                countryCode:(NSNumber *)countryCode {
+  @synchronized(self) {
+    NBGeocoderMetaDataHelper *helper = [_metadataHelpers objectForKey:languageCode];
+    if (helper == nil) {
+      helper = _metadataHelperFactory(countryCode, languageCode);
+      if (helper != nil) {
+        [_metadataHelpers setObject:helper forKey:languageCode];
+      }
+    }
+    return helper;
+  }
+}
+
 - (nullable NSString *)descriptionForValidNumber:(NBPhoneNumber *)phoneNumber
                                 withLanguageCode:(NSString *)languageCode {
   // If the NSCache doesn't contain a key equivalent to languageCode, create a
   // new NBGeocoderMetadataHelper object with a language set equal to
   // languageCode and default country code to United States / Canada
-  if ([_metadataHelpers objectForKey:languageCode] == nil) {
-    [_metadataHelpers setObject:_metadataHelperFactory(phoneNumber.countryCode, languageCode)
-                         forKey:languageCode];
-  }
-  NSString *result = [[_metadataHelpers objectForKey:languageCode] searchPhoneNumber:phoneNumber];
+  NBGeocoderMetaDataHelper *helper =
+      [self metadataHelperForLanguageCode:languageCode countryCode:phoneNumber.countryCode];
+  NSString *result = [helper searchPhoneNumber:phoneNumber];
   if (result == nil) {
     return [self countryNameForNumber:phoneNumber withLanguageCode:languageCode];
   } else {
```

**File**: `libPhoneNumberIOSSwiftTests/PhoneNumberIOSSwiftTests.swift` (modified, +1/-1)
```diff
@@ -29,6 +29,6 @@ final class PhoneNumberIOSSwiftTests: XCTestCase {
         let geocoder = PhoneNumberGeocoder.shared
         let number = try util.parse("16502530000", defaultRegion: "US")
 
-        XCTAssertEqual("United States", geocoder.description(for: number, languageCode: "en"))
+        XCTAssertEqual("Mountain View, CA", geocoder.description(for: number, languageCode: "en"))
     }
 }
```

**File**: `libPhoneNumberSwiftGeocodingTests/PhoneNumberGeocodingFacadeTests.swift` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+import Testing
+import libPhoneNumberSwiftCore
+import libPhoneNumberSwiftGeocoding
+
+@Suite("Geocoder facade")
+struct PhoneNumberGeocodingFacadeTests {
+    private let util = PhoneNumberUtility.shared
+    private let geocoder = PhoneNumberGeocoder.shared
+
+    @Test("A geographical number resolves to a locality, not just the country")
+    func localityForGeographicalNumber() throws {
+        let number = try util.parse("6502530000", defaultRegion: "US")
+        let description = geocoder.description(forValidNumber: number, languageCode: "en")
+
+        #expect(description == "Mountain View, CA")
+    }
+
+    /// Only `en.db` carries worldwide coverage; the other databases hold their
+    /// own country. A language without an entry falls back to the country name,
+    /// which is correct behaviour, not a missing lookup.
+    @Test("Descriptions are localized by language code", arguments: [
+        ("en", "Seoul"),
+        ("ko", "서울"),
+    ])
+    func localizedDescriptions(languageCode: String, expected: String) throws {
+        let number = try util.parse("+8221234567", defaultRegion: nil)
+
+        #expect(geocoder.description(forValidNumber: number, languageCode: languageCode) == expected)
+    }
+
+    @Test("A language without locality data falls back to the country name")
+    func localizedFallback() throws {
+        let number = try util.parse("6502530000", defaultRegion: "US")
+
+        #expect(geocoder.description(forValidNumber: number, languageCode: "ko") == "미국")
+    }
+
+    @Test("A caller in the same region sees the locality; a caller abroad sees the country")
+    func userRegionChangesGranularity() throws {
+        let number = try util.parse("6502530000", defaultRegion: "US")
+
+        #expect(geocoder.description(for: number, languageCode: "en", userRegion: "US") == "Mountain View, CA")
+        #expect(geocoder.description(for: number, languageCode: "en", userRegion: "KR") == "United States")
+    }
+
+    /// Regression test: a lookup for a country the language's database does not
+    /// carry used to finalize the prepared statement and leave the helper
+    /// unusable, so every later lookup in that language returned a country name.
+    @Test("An uncovered country does not disable later lookups in the same language")
+    func uncoveredCountryDoesNotPoisonTheLanguage() throws {
+        let geocoder = PhoneNumberGeocoder()
+        let unitedStates = try util.parse("6502530000", defaultRegion: "US")
+        let korea = try util.parse("+8221234567", defaultRegion: nil)
+
+        // The Korean database carries only Korea, so this falls back.
+        #expect(geocoder.description(forValidNumber: unitedStates, languageCode: "ko") == "미국")
+        // The same helper must still answer for a country it does carry.
+        #expect(geocoder.description(forValidNumber: korea, languageCode: "ko") == "서울")
+        // And it must keep working when the country alternates.
+        #expect(geocoder.description(forValidNumber: unitedStates, languageCode: "ko") == "미국")
+        #expect(geocoder.description(forValidNumber: korea, languageCode: "ko") == "서울")
+    }
+
+    @Test("An unparseable number yields no description")
+    func unknownNumber() {
+        let number = PhoneNumber()
+        number.countryCode = 999
+        number.nationalNumber = 1
+
+        #expect(geocoder.description(for: number, languageCode: "en") == nil)
+    }
+
+    @Test("Concurrent lookups share one database connection safely")
+    func concurrentLookups() async throws {
+        let results = await withTaskGroup(of: String?.self) { group in
+            for _ in 0..<16 {
+                group.addTask {
+                    let util = PhoneNumberUtility.shared
+                    guard let number = try? util.parse("6502530000", defaultRegion: "US") else {
+                        return nil
+                    }
+                    return PhoneNumberGeocoder.shared.description(forValidNumber: number, languageCode: "en")
+                }
+            }
+
+            var collected: [String?] = []
+            for await result in group {
+                collected.append(result)
+            }
+            return collected
+        }
+
+        #expect(results.count == 16)
+        #expect(results.allSatisfy { $0 == "Mountain View, CA" })
+    }
+}
```

---

### Incident Patch 5: `caa789e4` (2026-09-12)
**Commit Message**: fix(geocoding): resolve metadata under SwiftPM and stop poisoning a language

Two failures that both surface as a correct-looking country name instead
of a locality, with no error and no crash.

The metadata bundle was never found under Swift Package Manager.
NBGeocoderMetaDataHelper appended GeocodingMetaData.bundle to
-[NSBundle bundleForClass:].resourceURL, which is where CocoaPods,
Carthage, and manual integration put the databases. SwiftPM nests them
inside a generated wrapper bundle, and emits that wrapper flat up to
Xcode 26 and macOS-structured from Xcode 27. No database was opened, so
every lookup fell through to countryNameForNumber:. Apply the same search
the carrier and timezone mappers already use, covering both layouts.

191c758 fixed this class of bug for carrier and timezone metadata and
recorded that geocoding resolves its bundle differently and was
unaffected. It resolves it differently, but it was affected: only the
Objective-C tests covered geocoding, and they inject a test bundle, so
the shipped path was never exercised.

Separately, a lookup for a country a language's database does not carry
disabled that language permanently. Only en.db has worldwide coverage

**File**: `README.md` (modified, +4/-0)
```diff
@@ -245,6 +245,10 @@ let number = try phoneUtil.parse("16502530000", defaultRegion: "US")
 let description = geocoder.description(for: number, languageCode: "en")
 ```
 
+Only the English database carries worldwide coverage. The other languages ship
+their own country, so a lookup outside it falls back to the localized country
+name rather than a locality.
+
 ### Carrier
 
 ```swift
```

**File**: `libPhoneNumberGeocoding/NBGeocoderMetaDataHelper.h` (modified, +17/-1)
```diff
@@ -29,10 +29,26 @@ NS_ASSUME_NONNULL_BEGIN
  */
 - (instancetype)initWithCountryCode:(NSNumber *)countryCode
                        withLanguage:(NSString *)languageCode
-                         withBundle:(NSBundle *)bundle;
+                         withBundle:(nullable NSBundle *)bundle;
 
+/**
+ * Initializer that resolves the shipped geocoding databases automatically.
+ *
+ * The payload is located by searching the loaded bundles, which covers
+ * CocoaPods, Carthage, manual integration, and the nested wrapper bundle
+ * SwiftPM generates. A helper created when no payload can be found answers
+ * every query with nil, and the geocoder falls back to country names.
+ */
 - (instancetype)initWithCountryCode:(NSNumber *)countryCode withLanguage:(NSString *)languageCode;
 
+/**
+ * The bundle holding the geocoding databases, or nil when none was found.
+ *
+ * Exposed so integrators can check whether the metadata resolved at all,
+ * instead of silently receiving country-level descriptions.
+ */
++ (nullable NSBundle *)defaultMetadataBundle;
+
 /**
  * Returns a text description for the given phone number. The description will be based on the
  * country code and national number attributes of the NBPhoneNumber parameter. If no result was
```

**File**: `libPhoneNumberGeocoding/NBGeocoderMetaDataHelper.m` (modified, +98/-11)
```diff
@@ -48,6 +48,10 @@ - (instancetype)initWithCountryCode:(NSNumber *)countryCode
     _countryCode = countryCode;
     _language = languageCode;
 
+    if (bundle == nil) {
+      return self;
+    }
+
     NSString *shortLanguageCode = [[languageCode componentsSeparatedByString:@"-"] firstObject];
     NSURL *databaseURL = [[bundle resourceURL]
         URLByAppendingPathComponent:[NSString stringWithFormat:@"%@.db", shortLanguageCode]];
@@ -69,25 +73,108 @@ - (instancetype)initWithCountryCode:(NSNumber *)countryCode
 }
 
 - (instancetype)initWithCountryCode:(NSNumber *)countryCode withLanguage:(NSString *)languageCode {
-  NSBundle *bundle = [NSBundle bundleForClass:self.classForCoder];
-  NSURL *resourceURL =
-      [[bundle resourceURL] URLByAppendingPathComponent:@"GeocodingMetaData.bundle"];
-  NSBundle *databaseBundle = [NSBundle bundleWithURL:resourceURL];
-  return [self initWithCountryCode:countryCode withLanguage:languageCode withBundle:databaseBundle];
+  return [self initWithCountryCode:countryCode
+                      withLanguage:languageCode
+                        withBundle:[NBGeocoderMetaDataHelper defaultMetadataBundle]];
+}
+
+// Locates GeocodingMetaData.bundle wherever the integration put it.
+//
+// Appending the payload to -[NSBundle bundleForClass:].resourceURL only works
+// for CocoaPods and manual integration, where the databases land next to the
+// consuming binary. SwiftPM nests them one level deeper, inside a generated
+// wrapper bundle, and emits that wrapper flat up to Xcode 26 but
+// macOS-structured (Contents/Resources) from Xcode 27. Without this search the
+// databases are simply not found and every lookup falls back to the country
+// name, with no error and no crash.
++ (NSBundle * _Nullable)defaultMetadataBundle {
+  static NSBundle *cachedBundle = nil;
+  static dispatch_once_t onceToken;
+  dispatch_once(&onceToken, ^{
+    NSMutableArray<NSBundle *> *searchBundles = [NSMutableArray arrayWithArray:NSBundle.allBundles];
+    [searchBundles addObjectsFromArray:NSBundle.allFrameworks];
+    [searchBundles addObject:[NSBundle bundleForClass:self]];
+    [searchBundles addObject:[NSBundle mainBundle]];
+
+    for (NSBundle *bundle in searchBundles) {
+      NSMutableArray<NSURL *> *baseURLs = [NSMutableArray array];
+      if (bundle.resourceURL != nil) {
+        [baseURLs addObject:bundle.resourceURL];
+      }
+      if (bundle.bundleURL != nil) {
+        [baseURLs addObject:bundle.bundleURL];
+      }
+
+      NSURL *parentURL = bundle.bundleURL;
+      for (NSUInteger index = 0; index < 5 && parentURL != nil; index++) {
+        parentURL = [parentURL URLByDeletingLastPathComponent];
+        if (parentURL != nil) {
+          [baseURLs addObject:parentURL];
+        }
+      }
+
+      for (NSURL *baseURL in baseURLs) {
+        NSURL *resourcesURL = [baseURL URLByAppendingPathComponent:@"Contents/Resources"];
+        NSURL *wrapperURL = [baseURL
+            URLByAppendingPathComponent:@"libPhoneNumber_libPhoneNumberGeocodingMetaData.bundle"];
+        NSURL *wrapperResourcesURL =
+            [wrapperURL URLByAppendingPathComponent:@"Contents/Resources"];
+        NSArray<NSURL *> *candidateURLs = @[
+          [baseURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+          [resourcesURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+          [wrapperURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+          [wrapperResourcesURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+        ];
+
+        for (NSURL *candidateURL in candidateURLs) {
+          // en.db ships in every build of the payload, so it identifies a
+          // populated bundle rather than an empty directory of the right name.
+          NSURL *databaseURL = [candidateURL URLByAppendingPathComponent:@"en.db"];
+          if ([[NSFileManager defaultManager] fileExistsAtPath:databaseURL.path]) {
+            cachedBundle = [NSBundle bundleWithURL:candidateURL];
+            return;
+          }
+        }
+      }
+    }
+  });
+
+  return cachedBundle;
 }
 
 - (NSString * _Nullable)searchPhoneNumber:(NBPhoneNumber *)phoneNumber {
   @synchronized(self) {
-    if (_database == NULL || _selectStatement == NULL) {
+    if (_database == NULL) {
       return nil;
     }
 
-    if (![phoneNumber.countryCode isEqualToNumber:_countryCode]) {
+    // Each database holds one table per country calling code, and only the
+    // English database covers every country. Preparing a statement for a
+    // country this database does not carry fails, which is an ordinary "no
+    // data for this number" answer -- not a broken helper. Leaving the failed
+    // statement in place used to disable the helper permanently, so a single
+    // lookup for an uncovered country downgraded every later lookup in that
+    // language to a country name.
+    if (_selectStatement == NULL || ![phoneNumber.countryCode isEqualToNumber:_countryCode]) {
       _country
```

**File**: `libPhoneNumberIOSSwiftTests/PhoneNumberIOSSwiftTests.swift` (modified, +1/-1)
```diff
@@ -29,6 +29,6 @@ final class PhoneNumberIOSSwiftTests: XCTestCase {
         let geocoder = PhoneNumberGeocoder.shared
         let number = try util.parse("16502530000", defaultRegion: "US")
 
-        XCTAssertEqual("United States", geocoder.description(for: number, languageCode: "en"))
+        XCTAssertEqual("Mountain View, CA", geocoder.description(for: number, languageCode: "en"))
     }
 }
```

**File**: `libPhoneNumberSwiftGeocodingTests/PhoneNumberGeocodingFacadeTests.swift` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+import Testing
+import libPhoneNumberSwiftCore
+import libPhoneNumberSwiftGeocoding
+
+@Suite("Geocoder facade")
+struct PhoneNumberGeocodingFacadeTests {
+    private let util = PhoneNumberUtility.shared
+    private let geocoder = PhoneNumberGeocoder.shared
+
+    @Test("A geographical number resolves to a locality, not just the country")
+    func localityForGeographicalNumber() throws {
+        let number = try util.parse("6502530000", defaultRegion: "US")
+        let description = geocoder.description(forValidNumber: number, languageCode: "en")
+
+        #expect(description == "Mountain View, CA")
+    }
+
+    /// Only `en.db` carries worldwide coverage; the other databases hold their
+    /// own country. A language without an entry falls back to the country name,
+    /// which is correct behaviour, not a missing lookup.
+    @Test("Descriptions are localized by language code", arguments: [
+        ("en", "Seoul"),
+        ("ko", "서울"),
+    ])
+    func localizedDescriptions(languageCode: String, expected: String) throws {
+        let number = try util.parse("+8221234567", defaultRegion: nil)
+
+        #expect(geocoder.description(forValidNumber: number, languageCode: languageCode) == expected)
+    }
+
+    @Test("A language without locality data falls back to the country name")
+    func localizedFallback() throws {
+        let number = try util.parse("6502530000", defaultRegion: "US")
+
+        #expect(geocoder.description(forValidNumber: number, languageCode: "ko") == "미국")
+    }
+
+    @Test("A caller in the same region sees the locality; a caller abroad sees the country")
+    func userRegionChangesGranularity() throws {
+        let number = try util.parse("6502530000", defaultRegion: "US")
+
+        #expect(geocoder.description(for: number, languageCode: "en", userRegion: "US") == "Mountain View, CA")
+        #expect(geocoder.description(for: number, languageCode: "en", userRegion: "KR") == "United States")
+    }
+
+    /// Regression test: a lookup for a country the language's database does not
+    /// carry used to finalize the prepared statement and leave the helper
+    /// unusable, so every later lookup in that language returned a country name.
+    @Test("An uncovered country does not disable later lookups in the same language")
+    func uncoveredCountryDoesNotPoisonTheLanguage() throws {
+        let geocoder = PhoneNumberGeocoder()
+        let unitedStates = try util.parse("6502530000", defaultRegion: "US")
+        let korea = try util.parse("+8221234567", defaultRegion: nil)
+
+        // The Korean database carries only Korea, so this falls back.
+        #expect(geocoder.description(forValidNumber: unitedStates, languageCode: "ko") == "미국")
+        // The same helper must still answer for a country it does carry.
+        #expect(geocoder.description(forValidNumber: korea, languageCode: "ko") == "서울")
+        // And it must keep working when the country alternates.
+        #expect(geocoder.description(forValidNumber: unitedStates, languageCode: "ko") == "미국")
+        #expect(geocoder.description(forValidNumber: korea, languageCode: "ko") == "서울")
+    }
+
+    @Test("An unparseable number yields no description")
+    func unknownNumber() {
+        let number = PhoneNumber()
+        number.countryCode = 999
+        number.nationalNumber = 1
+
+        #expect(geocoder.description(for: number, languageCode: "en") == nil)
+    }
+
+    @Test("Concurrent lookups share one database connection safely")
+    func concurrentLookups() async throws {
+        let results = await withTaskGroup(of: String?.self) { group in
+            for _ in 0..<16 {
+                group.addTask {
+                    let util = PhoneNumberUtility.shared
+                    guard let number = try? util.parse("6502530000", defaultRegion: "US") else {
+                        return nil
+                    }
+                    return PhoneNumberGeocoder.shared.description(forValidNumber: number, languageCode: "en")
+                }
+            }
+
+            var collected: [String?] = []
+            for await result in group {
+                collected.append(result)
+            }
+            return collected
+        }
+
+        #expect(results.count == 16)
+        #expect(results.allSatisfy { $0 == "Mountain View, CA" })
+    }
+}
```

**File**: `libPhoneNumberSwiftGeocodingTests/PhoneNumberSwiftGeocodingTests.swift` (modified, +1/-1)
```diff
@@ -8,6 +8,6 @@ final class PhoneNumberSwiftGeocodingTests: XCTestCase {
         let geocoder = PhoneNumberGeocoder.shared
         let number = try util.parse("16502530000", defaultRegion: "US")
 
-        XCTAssertEqual("United States", geocoder.description(for: number, languageCode: "en"))
+        XCTAssertEqual("Mountain View, CA", geocoder.description(for: number, languageCode: "en"))
     }
 }
```

---

### Incident Patch 6: `32f79982` (2026-09-12)
**Commit Message**: fix(core): guard shared mutable state in the Objective-C core

The shared NBPhoneNumberUtil is reachable from any thread, and three pieces
of state it owns or reaches were not protected:

- NBMetadataHelper built its region-to-calling-code table lazily with no
  synchronization, so concurrent first use raced on the ivar write.
- NBPhoneNumberOfflineGeocoder looked up its per-language helper in an
  NSCache and inserted on a miss, so concurrent callers could each open
  their own SQLite connection for the same language.
- NBRegularExpressionCache held @synchronized(self) across pattern
  compilation, serializing every caller behind an unrelated pattern being
  built, including callers that would have hit the cache.

Lock the metadata table with os_unfair_lock, move the geocoder's lookup
and insertion under one lock, and narrow the regex cache's lock to the
lookup and the insertion so compilation happens outside it. Two threads
racing on the same new pattern may now each compile it; the duplicate is
discarded on insertion.

This is a prerequisite for declaring the Swift facades Sendable: that
claim rests on this locking rather than on anything the compiler checks.

Co-Authored-By: Cl

**File**: `libPhoneNumber/NBMetadataHelper.m` (modified, +13/-1)
```diff
@@ -8,6 +8,8 @@
 
 #import "NBMetadataHelper.h"
 
+#import <os/lock.h>
+
 #import <NBGeneratedPhoneNumberMetaData.h>
 #import "NBPhoneMetaData.h"
 
@@ -34,7 +36,11 @@ @interface NBMetadataHelper ()
 @implementation NBMetadataHelper {
  @private
   NSDictionary *_phoneNumberDataDictionary;
+  // Lazily derived from _phoneNumberDataDictionary. Guarded by
+  // _countryCodeToCountryNumberLock because the helper is shared by the
+  // NBPhoneNumberUtil singleton and can be reached from multiple threads.
   NSDictionary *_countryCodeToCountryNumberDictionary;
+  os_unfair_lock _countryCodeToCountryNumberLock;
 }
 
 - (instancetype)init {
@@ -55,6 +61,7 @@ - (instancetype)initWithZippedDataBytes:(z_const Bytef *)data
   self = [super init];
 
   if (self != nil) {
+    _countryCodeToCountryNumberLock = OS_UNFAIR_LOCK_INIT;
     _metadataCache = [[NSCache alloc] init];
     _metadataMapCache = [[NSCache alloc] init];
     _phoneNumberDataDictionary =
@@ -74,6 +81,8 @@ - (instancetype)initWithZippedDataBytes:(z_const Bytef *)data
  */
 
 - (NSDictionary *)countryCodeToCountryNumberDictionary {
+  os_unfair_lock_lock(&_countryCodeToCountryNumberLock);
+
   if (_countryCodeToCountryNumberDictionary == nil) {
     NSDictionary *countryCodeToRegionCodeMap = [self countryCodeToRegionCodeDictionary];
     NSMutableDictionary *map = [[NSMutableDictionary alloc] init];
@@ -86,7 +95,10 @@ - (NSDictionary *)countryCodeToCountryNumberDictionary {
     _countryCodeToCountryNumberDictionary = [map copy];
   }
 
-  return _countryCodeToCountryNumberDictionary;
+  NSDictionary *result = _countryCodeToCountryNumberDictionary;
+  os_unfair_lock_unlock(&_countryCodeToCountryNumberLock);
+
+  return result;
 }
 
 - (NSDictionary *)countryCodeToRegionCodeDictionary {
```

**File**: `libPhoneNumber/NBRegularExpressionCache.m` (modified, +35/-17)
```diff
@@ -8,13 +8,17 @@
 
 #import "NBRegularExpressionCache.h"
 
+#import <os/lock.h>
+
 @interface NBRegularExpressionCache()
 
 @property (nonatomic, strong) NSCache *cache;
 
 @end
 
-@implementation NBRegularExpressionCache
+@implementation NBRegularExpressionCache {
+  os_unfair_lock _cacheLock;
+}
 
 + (instancetype)sharedInstance {
   static NBRegularExpressionCache *instance;
@@ -29,34 +33,48 @@ + (instancetype)sharedInstance {
 - (instancetype)init {
   self = [super init];
   if (self != nil) {
+    _cacheLock = OS_UNFAIR_LOCK_INIT;
     _cache = [[NSCache alloc] init];
   }
 
   return self;
 }
 
 - (NSRegularExpression *)regularExpressionForPattern:(NSString *)pattern error:(NSError **)error {
-  @synchronized(self) {
-    NSRegularExpression *cachedObject = [self.cache objectForKey:pattern];
-    if (cachedObject != nil) {
-      return cachedObject;
-    }
+  // Cache hits, which are the overwhelmingly common case, only hold the lock
+  // for the lookup itself. Compilation happens outside the lock so concurrent
+  // callers are not serialized behind an unrelated pattern being built. Two
+  // threads racing on the same new pattern may each compile it; the duplicate
+  // is simply discarded by the insertion below.
+  os_unfair_lock_lock(&_cacheLock);
+  NSRegularExpression *cachedObject = [self.cache objectForKey:pattern];
+  os_unfair_lock_unlock(&_cacheLock);
+
+  if (cachedObject != nil) {
+    return cachedObject;
+  }
 
-    NSError *regExError = nil;
-    NSRegularExpression *regEx = [[NSRegularExpression alloc] initWithPattern:pattern
-                                                                      options:kNilOptions
-                                                                        error:&regExError];
-    if (regEx == nil) {
-      if (error != NULL) {
-        *error = regExError;
-      }
-      return nil;
+  NSError *regExError = nil;
+  NSRegularExpression *regEx = [[NSRegularExpression alloc] initWithPattern:pattern
+                                                                    options:kNilOptions
+                                                                      error:&regExError];
+  if (regEx == nil) {
+    if (error != NULL) {
+      *error = regExError;
     }
+    return nil;
+  }
 
+  os_unfair_lock_lock(&_cacheLock);
+  NSRegularExpression *raced = [self.cache objectForKey:pattern];
+  if (raced != nil) {
+    regEx = raced;
+  } else {
     [self.cache setObject:regEx forKey:pattern];
-
-    return regEx;
   }
+  os_unfair_lock_unlock(&_cacheLock);
+
+  return regEx;
 }
 
 @end
```

**File**: `libPhoneNumberGeocoding/NBPhoneNumberOfflineGeocoder.m` (modified, +21/-5)
```diff
@@ -50,16 +50,32 @@ + (NBPhoneNumberOfflineGeocoder *)sharedInstance {
   return instance;
 }
 
+// Returns the cached helper for |languageCode|, creating it on first use.
+//
+// The lookup and the insertion are performed under a single lock so concurrent
+// callers cannot each open their own SQLite connection for the same language.
+- (NBGeocoderMetaDataHelper *)metadataHelperForLanguageCode:(NSString *)languageCode
+                                                countryCode:(NSNumber *)countryCode {
+  @synchronized(self) {
+    NBGeocoderMetaDataHelper *helper = [_metadataHelpers objectForKey:languageCode];
+    if (helper == nil) {
+      helper = _metadataHelperFactory(countryCode, languageCode);
+      if (helper != nil) {
+        [_metadataHelpers setObject:helper forKey:languageCode];
+      }
+    }
+    return helper;
+  }
+}
+
 - (nullable NSString *)descriptionForValidNumber:(NBPhoneNumber *)phoneNumber
                                 withLanguageCode:(NSString *)languageCode {
   // If the NSCache doesn't contain a key equivalent to languageCode, create a
   // new NBGeocoderMetadataHelper object with a language set equal to
   // languageCode and default country code to United States / Canada
-  if ([_metadataHelpers objectForKey:languageCode] == nil) {
-    [_metadataHelpers setObject:_metadataHelperFactory(phoneNumber.countryCode, languageCode)
-                         forKey:languageCode];
-  }
-  NSString *result = [[_metadataHelpers objectForKey:languageCode] searchPhoneNumber:phoneNumber];
+  NBGeocoderMetaDataHelper *helper =
+      [self metadataHelperForLanguageCode:languageCode countryCode:phoneNumber.countryCode];
+  NSString *result = [helper searchPhoneNumber:phoneNumber];
   if (result == nil) {
     return [self countryNameForNumber:phoneNumber withLanguageCode:languageCode];
   } else {
```

---

### Incident Patch 7: `24c0690d` (2026-09-12)
**Commit Message**: fix(ci): track the package workspace so platform builds resolve the package

The platform build matrix failed on every destination. xcodebuild resolves
libPhoneNumber.xcodeproj rather than Package.swift when both sit in the
repository root, so the jobs pointed at .swiftpm/xcode/package.xcworkspace
to select the package. That path is generated by Xcode and was covered by
the blanket .swiftpm entry in .gitignore, so it exists in a working copy
that has been opened in Xcode and not in a fresh checkout. The jobs passed
locally for exactly that reason and failed on CI with "does not contain a
scheme named libPhoneNumber-Package".

Narrow the ignore rules to track contents.xcworkspacedata, which is seven
lines of XML pointing at the package itself, while keeping every piece of
per-user Xcode state under .swiftpm ignored. Add a step that checks for
the file first, so a future regression reports the cause rather than a
confusing scheme error.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (modified, +12/-0)
```diff
@@ -141,6 +141,18 @@ jobs:
       - name: Show Xcode version
         run: xcodebuild -version
 
+      # xcodebuild resolves libPhoneNumber.xcodeproj rather than Package.swift
+      # when both are in the repository root, and that project carries only the
+      # three Objective-C schemes. Building the package's own schemes requires
+      # the workspace below, so fail with a clear message if it is missing
+      # rather than with "does not contain a scheme named libPhoneNumber-Package".
+      - name: Check the package workspace is present
+        run: |
+          if [ ! -f .swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata ]; then
+            echo "Missing .swiftpm/xcode/package.xcworkspace; see the .swiftpm rules in .gitignore." >&2
+            exit 1
+          fi
+
       # Package.swift declares macOS, iOS, macCatalyst, tvOS, watchOS and
       # visionOS. `swift test` only covers macOS, so each of the others is
       # built here; without this a platform-specific break ships unnoticed.
```

**File**: `.gitignore` (modified, +11/-1)
```diff
@@ -28,4 +28,14 @@ ObjectiveC.gcda
 
 # SPM
 .build
-.swiftpm
+
+# Track only the generated package workspace. xcodebuild picks
+# libPhoneNumber.xcodeproj over Package.swift when both sit in the repository
+# root, so building the package's own schemes needs this file to exist in a
+# fresh checkout. Everything else under .swiftpm is per-user Xcode state.
+.swiftpm/*
+!.swiftpm/xcode/
+.swiftpm/xcode/*
+!.swiftpm/xcode/package.xcworkspace/
+.swiftpm/xcode/package.xcworkspace/*
+!.swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata
```

**File**: `.swiftpm/xcode/package.xcworkspace/contents.xcworkspacedata` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<Workspace
+   version = "1.0">
+   <FileRef
+      location = "self:">
+   </FileRef>
+</Workspace>
```

---

### Incident Patch 8: `c092e9d4` (2026-09-12)
**Commit Message**: docs: add changelog, contributing guide, security policy, and DocC

The repository had no changelog, no contributing guide, no security
policy, and no issue templates. 2.0.0 raised deployment targets from
iOS 12 to iOS 15, and the only record of that breaking change was a
paragraph in the README.

CHANGELOG.md starts from the unreleased work and back-fills 2.0.1, 2.0.0,
and the 1.6.0 facade split. CONTRIBUTING.md states what is specific to
this repository rather than generic advice: behavior follows upstream
libphonenumber, metadata is generated rather than edited, the Swift
facades stay thin, and adding mutable Objective-C state invalidates the
Sendable conformances. SECURITY.md separates a parsing vulnerability from
the much more common report that a number was classified unexpectedly,
which is a metadata issue.

Issue templates ask for the number, the region, and the integration
method up front, since a report without them cannot be reproduced, and
route upstream behavior questions to Google's tracker.

A DocC catalog documents the Swift core facade: when to use
PhoneNumberValue instead of PhoneNumber, which types are Sendable and
why, and how the error model divides between thr

**File**: `.github/ISSUE_TEMPLATE/bug_report.yml` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+name: Bug report
+description: A number is parsed, formatted, validated, or described incorrectly, or an API misbehaves.
+labels: ["bug"]
+body:
+  - type: markdown
+    attributes:
+      value: |
+        This library ports Google's libphonenumber. If Google's own
+        implementation agrees with the behavior you are seeing, the change
+        belongs upstream rather than here — please say so below and link it.
+
+  - type: input
+    id: number
+    attributes:
+      label: Phone number
+      description: >
+        The number that reproduces the problem, with its region. Use a test or
+        example number rather than a real person's number where you can.
+      placeholder: "+82 10 6543 1234, default region KR"
+    validations:
+      required: true
+
+  - type: textarea
+    id: expected
+    attributes:
+      label: Expected and actual result
+      description: What you expected each API to return, and what it returned.
+      placeholder: |
+        isValidNumber: expected true, got false
+        format(.e164): expected "+821065431234", got "+8201065431234"
+    validations:
+      required: true
+
+  - type: textarea
+    id: reproduction
+    attributes:
+      label: Reproduction
+      description: The smallest snippet that shows the problem.
+      render: swift
+    validations:
+      required: true
+
+  - type: input
+    id: version
+    attributes:
+      label: Library version
+      placeholder: "2.0.1"
+    validations:
+      required: true
+
+  - type: dropdown
+    id: integration
+    attributes:
+      label: Integration
+      options:
+        - Swift Package Manager
+        - CocoaPods
+        - Carthage
+        - Manual
+    validations:
+      required: true
+
+  - type: input
+    id: module
+    attributes:
+      label: Module
+      description: Which product you imported, for example libPhoneNumberSwiftCore or libPhoneNumberGeocoding.
+      placeholder: libPhoneNumberSwiftCore
+    validations:
+      required: true
+
+  - type: input
+    id: environment
+    attributes:
+      label: Xcode and platform
+      placeholder: "Xcode 27.0, iOS 18.2 simulator"
+    validations:
+      required: true
+
+  - type: textarea
+    id: upstream
+    attributes:
+      label: Upstream comparison
+      description: >
+        Optional but very helpful. What does Google's libphonenumber do with the
+        same number? The demo at https://libphonenumber.appspot.com answers this
+        in a few seconds.
```

**File**: `.github/ISSUE_TEMPLATE/config.yml` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+blank_issues_enabled: true
+contact_links:
+  - name: Upstream libphonenumber behavior
+    url: https://github.com/google/libphonenumber/issues
+    about: Report parsing, formatting, or validation rules that are wrong in Google's library itself, not just in this port.
+  - name: Security vulnerability
+    url: https://github.com/iziz/libPhoneNumber-iOS/security/advisories/new
+    about: Report privately instead of opening an issue.
```

**File**: `.github/ISSUE_TEMPLATE/feature_request.yml` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+name: Feature request
+description: Suggest an API or module addition.
+labels: ["enhancement"]
+body:
+  - type: markdown
+    attributes:
+      value: |
+        Behavior changes to parsing, formatting, or validation belong upstream in
+        Google's libphonenumber. This form is for the Apple-platform surface:
+        Swift APIs, module layout, packaging, and the SwiftUI component.
+
+  - type: textarea
+    id: problem
+    attributes:
+      label: Problem
+      description: What are you trying to do, and what makes it awkward today?
+    validations:
+      required: true
+
+  - type: textarea
+    id: proposal
+    attributes:
+      label: Proposed API
+      description: Sketch the call site you would like to write.
+      render: swift
+
+  - type: textarea
+    id: alternatives
+    attributes:
+      label: What you do instead today
+      description: >
+        Including whether the existing `objc` escape hatch on the facades covers
+        it.
```

**File**: `.github/ISSUE_TEMPLATE/metadata_update.yml` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+name: Metadata or numbering plan issue
+description: A numbering plan changed, or a valid number is rejected because the bundled metadata is out of date.
+labels: ["metadata"]
+body:
+  - type: markdown
+    attributes:
+      value: |
+        Metadata comes from Google's libphonenumber and is refreshed as a whole
+        rather than patched per number. See `docs/METADATA_PATCH_POLICY.md` for
+        when a local override is acceptable.
+
+  - type: input
+    id: number
+    attributes:
+      label: Phone number and region
+      placeholder: "+256 79 412 3456, region UG"
+    validations:
+      required: true
+
+  - type: textarea
+    id: behavior
+    attributes:
+      label: Current and expected classification
+      placeholder: |
+        Current: isValidNumber false, type UNKNOWN
+        Expected: isValidNumber true, type MOBILE
+    validations:
+      required: true
+
+  - type: input
+    id: upstream_ref
+    attributes:
+      label: Upstream reference
+      description: >
+        The Google libphonenumber release or commit that carries the corrected
+        metadata, if you know it.
+      placeholder: "v9.0.38"
+
+  - type: textarea
+    id: source
+    attributes:
+      label: Regulator source
+      description: >
+        A link to the telecom regulator's announcement, if this is a numbering
+        plan change that upstream has not picked up yet.
```

**File**: `CHANGELOG.md` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+# Changelog
+
+This file records user-visible changes. Metadata refreshes are listed in
+`docs/METADATA_UPDATE_LOG.md` and are only summarized here.
+
+The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
+and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
+as described in `docs/RELEASE_RUNBOOK.md`.
+
+## Unreleased
+
+This release carries breaking API changes and must be published as a major
+version.
+
+### Fixed
+
+- Geocoding now finds its metadata when the package is consumed through Swift
+  Package Manager. `NBGeocoderMetaDataHelper` looked for
+  `GeocodingMetaData.bundle` directly beside the consuming binary, which is only
+  where CocoaPods, Carthage, and manual integration put it. SwiftPM nests the
+  payload inside a generated wrapper bundle, so no database was ever opened and
+  every lookup fell back to the country name, with no error and no crash. The
+  same search the carrier and timezone mappers already use is now applied here,
+  covering both the flat layout SwiftPM emitted up to Xcode 26 and the
+  macOS-structured layout it emits from Xcode 27. `descriptionForNumber:` on a
+  Mountain View number returns `"Mountain View, CA"` instead of
+  `"United States"`.
+- A geocoding lookup for a country a language's database does not carry no
+  longer disables that language permanently. Preparing the query for a missing
+  table left the finalized statement in place, after which every later lookup in
+  that language short-circuited to nil. A Korean-locale app that geocoded one US
+  number lost city-level Korean geocoding for the rest of the process.
+- `NBMetadataHelper`'s region-to-calling-code table is built under a lock. It was
+  populated lazily with no synchronization, so concurrent first use raced.
+- `NBPhoneNumberOfflineGeocoder` creates its per-language helpers under a lock,
+  instead of a check-then-insert that let concurrent callers each open their own
+  SQLite connection for the same language.
+
+### Added
+
+- visionOS is a supported platform. It is declared in `Package.swift`, every
+  podspec sets `visionos.deployment_target`, and CI builds every product for it.
+- All Swift facade entry points are `Sendable`, so `PhoneNumberUtility.shared`
+  and its siblings can be used from Swift 6 code without a concurrency error.
+  The conformances are `@unchecked` and documented against the Objective-C
+  core's locking, and the concurrency test suite exercises the shared instances
+  from many tasks at once under the thread sanitizer.
+- `PhoneNumberValueError` conforms to `Sendable` and `LocalizedError`, and gains
+  `init(_: Error)` for wrapping errors raised by the Objective-C core.
+- `NBGeocoderMetaDataHelper.defaultMetadataBundle` is public, so integrators can
+  check whether the geocoding metadata resolved at all.
+- Test coverage for the Swift facades: Objective-C enum bridging is pinned case
+  by case, concurrency is exercised under load, and each optional module has
+  behavioral tests beyond its single smoke test.
+- CI builds every product for iOS, tvOS, watchOS, visionOS, and Mac Catalyst,
+  runs the suite under the thread sanitizer, publishes a coverage report, and
+  lints every podspec. Five podspecs were previously never linted, and four
+  declared platforms were never built.
+
+### Changed
+
+- The package requires Swift 6 tools (`swift-tools-version:6.0`) and builds in
+  the Swift 6 language mode. Podspecs accept Swift 5.9 or 6.0.
+- **Breaking.** `PhoneNumberFieldState.error` is a `PhoneNumberValueError?`
+  rather than an existential `Error?`. The state is now `Sendable` and its
+  `Equatable` conformance is synthesized instead of comparing error descriptions.
+  Code that reads `state.error` as an `NSError` needs to switch over the enum.
+- **Breaking.** `PhoneNumberEnriching` requires `Sendable`. Existing conformances
+  compile unchanged unless they capture non-`Sendable` state.
+- `PhoneNumberUtility.phoneNumber(from:)` reports failures through
+  `PhoneNumberValueError(_:)`, consistent with the other `Result`-returning APIs.
+- The regular-expression cache compiles patterns outside its lock, so a cache hit
+  is no longer serialized behind an unrelated pattern being built.
+
+### Maintenance
+
+- `scripts/testXcodeSchemes.swift` resolves an installed iPhone simulator
+  instead of defaulting to a pinned model name. The pinned name fails outright
+  on any machine whose Xcode ships a different set of simulators.
+- `scripts/publishPodspecs.swift` parses `pod ipc spec` output starting at the
+  first brace, so CocoaPods' non-UTF-8 terminal warning is no longer reported as
+  a malformed podspec.
+- `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, and issue templates added.
+- A DocC catalog documents the Swift core facade, covering the value type, the
+  concurrency guarantees, and the error model.
+
+### Deprecated
+
+- `PhoneNumberError`. It was public but never thrown; every t
```

**File**: `CONTRIBUTING.md` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+# Contributing
+
+Thanks for helping maintain libPhoneNumber for iOS. This document covers what a
+change needs before it can be merged. The deeper references live in `docs/`.
+
+## Before You Start
+
+This library is a port of Google's
+[libphonenumber](https://github.com/google/libphonenumber). Parsing, formatting,
+validation, geocoding, and short-number behavior follow upstream. If a number is
+handled differently here than in Google's Java or JavaScript implementation,
+that is a bug in this port; if you disagree with the behavior itself, the change
+belongs upstream first.
+
+Two consequences follow:
+
+- Behavior changes should cite the upstream code or metadata they match.
+- Metadata is generated, not edited. Run the updater scripts; do not hand-edit
+  `libPhoneNumber/NBGeneratedPhoneNumberMetaData.m` or the `generatedJSON`
+  files. Local overrides are only allowed under `docs/METADATA_PATCH_POLICY.md`.
+
+## Where Code Goes
+
+- The Objective-C core is the source of truth. Parsing and validation logic
+  belongs in `libPhoneNumber/`, not in a Swift facade.
+- The Swift facades are thin wrappers. They map types, they do not reimplement
+  behavior.
+- UI code belongs in `libPhoneNumberSwiftUI`, which consumers opt into
+  separately.
+
+## Development
+
+Build and test:
+
+```bash
+swift test
+```
+
+The full local checklist, including the non-English locale run, the per-platform
+builds, the thread sanitizer, and the Xcode scheme tests, is in
+`docs/TESTING.md`.
+
+Run the parity checks when you touch public API or the test suites:
+
+```bash
+swift scripts/checkUpstreamTestParity.swift
+swift scripts/checkUpstreamAPIParity.swift
+```
+
+## Tests
+
+Every bug fix needs a test that fails before the fix and passes after it. State
+in the pull request that you checked this; a test that passes either way
+documents behavior but does not protect it.
+
+New tests use [Swift Testing](https://developer.apple.com/documentation/testing)
+(`import Testing`). The existing XCTest suites, including the large
+Objective-C ones ported from upstream, stay as they are; do not convert them
+wholesale, because their structure is what makes upstream parity auditable.
+
+## Concurrency
+
+The Swift facades are declared `@unchecked Sendable` on the strength of the
+Objective-C core's internal locking. If you add mutable state to any Objective-C
+type reachable from a facade, that claim stops being true. Guard the state, and
+extend the concurrency suites in `libPhoneNumberSwiftCoreTests` so the guarantee
+is exercised rather than assumed. They run under the thread sanitizer in CI.
+
+## Public API
+
+Adding API is a minor release; changing or removing it is a major one. See
+`docs/RELEASE_RUNBOOK.md`. Deprecate rather than delete where you can, and give
+the deprecation message a replacement to point at.
+
+Record anything user-visible in `CHANGELOG.md` under `## Unreleased`.
+
+## Pull Requests
+
+Fill in the pull request template. It asks for the upstream reference, the
+metadata scope, the parity checks, and the test commands you ran. Paste the
+command output rather than asserting the result, so a future release can audit
+the decision from the log instead of from memory.
+
+Keep the diff focused. Unrelated formatting churn makes the metadata and parity
+review much harder.
```

**File**: `README.md` (modified, +6/-0)
```diff
@@ -510,6 +510,12 @@ swift scripts/testXcodeSchemes.swift
    swift scripts/publishPodspecs.swift --publish
    ```
 
+## Contributing
+
+- [Changelog](CHANGELOG.md)
+- [Contributing guide](CONTRIBUTING.md)
+- [Security policy](SECURITY.md)
+
 ## Maintenance Guides
 
 - [Upstream parity guide](docs/UPSTREAM_PARITY.md)
```

**File**: `SECURITY.md` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+# Security Policy
+
+## Supported Versions
+
+| Version | Supported |
+| --- | --- |
+| 2.x | Yes |
+| 1.7.x | Security fixes only, for projects that cannot build with Xcode 27 |
+| < 1.7 | No |
+
+## Reporting a Vulnerability
+
+Report vulnerabilities privately through
+[GitHub's private vulnerability reporting](https://github.com/iziz/libPhoneNumber-iOS/security/advisories/new).
+Do not open a public issue for a suspected vulnerability.
+
+Please include the affected version, the integration method (Swift Package
+Manager, CocoaPods, Carthage, or manual), and an input that reproduces the
+problem. Phone numbers in a report are treated as test data; do not send real
+users' numbers.
+
+You can expect an initial response within 7 days.
+
+## Scope
+
+This library parses untrusted text. Reports that are in scope include:
+
+- Crashes, hangs, or unbounded memory growth reachable from a parsing,
+  formatting, validation, geocoding, or short-number API.
+- Catastrophic backtracking in the regular expressions built from metadata.
+- Reads of data outside the bundled metadata.
+
+The following are not vulnerabilities:
+
+- A number being classified as valid or invalid contrary to expectation. That is
+  a metadata or parity issue; open a normal issue.
+- Carrier or timezone results being wrong or outdated. Both come from prefix
+  metadata, and the carrier data reflects original assignment rather than the
+  current carrier in regions with number portability.
+- Geocoding descriptions being coarser than expected for languages whose
+  database carries only their own country.
```

---

### Incident Patch 9: `06c5738d` (2026-09-12)
**Commit Message**: ci: build every declared platform, lint every podspec, run under TSan

Two gaps let breakage ship unnoticed.

Five of the thirteen podspecs were never linted: both Objective-C carrier
and timezone specs, and three Swift facade specs. A broken spec in any of
them passed CI and failed at publish time. The lint job now iterates the
full list, and a following step fails if a podspec exists that the
workflow does not name, so the next spec cannot be added without being
linted.

Package.swift declares six platforms and `swift test` covers one. tvOS,
watchOS, macCatalyst, and now visionOS had no build verification at all.
A matrix job builds every product for each.

Two jobs are added alongside: the suite under the thread sanitizer, which
is what substantiates the facades' @unchecked Sendable conformances, and
a coverage report published as an artifact.

Two maintenance scripts were brittle in ways that only show up off CI.
testXcodeSchemes.swift defaulted to a destination naming iPhone 16, so it
failed outright on a machine whose Xcode ships a different simulator set;
it now resolves an installed iPhone the way the workflow already does.
publishPodspecs.swift parsed the merged stdout and

**File**: `.github/pull_request_template.md` (modified, +5/-0)
```diff
@@ -18,11 +18,16 @@
 - [ ] `swift test`
 - [ ] `LC_ALL=ko_KR.UTF-8 LANG=ko_KR.UTF-8 swift test`
 - [ ] `swift build -c release`
+- [ ] `swift test --sanitize=thread` (when shared state or a facade entry point changed)
 - [ ] `xcodebuild test -scheme libPhoneNumber -destination 'id=<simulator-udid>'`
 - [ ] `xcodebuild test -scheme libPhoneNumberGeocoding -destination 'id=<simulator-udid>'`
 - [ ] `xcodebuild test -scheme libPhoneNumberShortNumber -destination 'id=<simulator-udid>'`
 - [ ] `git diff --check`
 
+## Changelog
+
+- [ ] `CHANGELOG.md` updated under `## Unreleased`, or not user-visible
+
 ## Notes
 
 - Intentional ObjC/API naming differences:
```

**File**: `.github/workflows/ci.yml` (modified, +116/-7)
```diff
@@ -82,14 +82,123 @@ jobs:
 
       - name: Lint podspecs
         run: |
+          set -euo pipefail
+          # Every podspec in the repository, so a broken spec cannot ship
+          # unnoticed. The core spec has no internal dependencies to resolve.
           pod lib lint libPhoneNumber-iOS.podspec --allow-warnings
-          pod lib lint libPhoneNumberGeocoding.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumberShortNumber.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumber-iOS-SwiftCore.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumber-iOS-SwiftGeocoding.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumber-iOS-SwiftShortNumber.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumber-iOS-SwiftUI.podspec --allow-warnings --include-podspecs='*.podspec'
-          pod lib lint libPhoneNumber-iOS-Swift.podspec --allow-warnings --include-podspecs='*.podspec'
+          for podspec in \
+            libPhoneNumberGeocoding.podspec \
+            libPhoneNumberShortNumber.podspec \
+            libPhoneNumberCarrier.podspec \
+            libPhoneNumberTimeZones.podspec \
+            libPhoneNumber-iOS-SwiftCore.podspec \
+            libPhoneNumber-iOS-SwiftGeocoding.podspec \
+            libPhoneNumber-iOS-SwiftShortNumber.podspec \
+            libPhoneNumber-iOS-SwiftCarrier.podspec \
+            libPhoneNumber-iOS-SwiftTimeZones.podspec \
+            libPhoneNumber-iOS-SwiftUI.podspec \
+            libPhoneNumber-iOS-SwiftUIEnrichment.podspec \
+            libPhoneNumber-iOS-Swift.podspec
+          do
+            pod lib lint "$podspec" --allow-warnings --include-podspecs='*.podspec'
+          done
+
+      - name: Check every podspec is linted
+        run: |
+          set -euo pipefail
+          missing=0
+          for podspec in *.podspec; do
+            if ! grep -q "$podspec" .github/workflows/ci.yml; then
+              echo "Podspec not covered by the lint job: $podspec" >&2
+              missing=1
+            fi
+          done
+          exit "$missing"
+
+  platform-builds:
+    name: Build for ${{ matrix.platform }}
+    runs-on: macos-latest
+
+    strategy:
+      fail-fast: false
+      matrix:
+        include:
+          - platform: iOS
+            destination: generic/platform=iOS
+          - platform: tvOS
+            destination: generic/platform=tvOS
+          - platform: watchOS
+            destination: generic/platform=watchOS
+          - platform: visionOS
+            destination: generic/platform=visionOS
+          - platform: macCatalyst
+            destination: platform=macOS,variant=Mac Catalyst
+
+    steps:
+      - name: Check out repository
+        uses: actions/checkout@v7.0.0
+
+      - name: Show Xcode version
+        run: xcodebuild -version
+
+      # Package.swift declares macOS, iOS, macCatalyst, tvOS, watchOS and
+      # visionOS. `swift test` only covers macOS, so each of the others is
+      # built here; without this a platform-specific break ships unnoticed.
+      - name: Build all products
+        run: |
+          xcodebuild build \
+            -workspace .swiftpm/xcode/package.xcworkspace \
+            -scheme libPhoneNumber-Package \
+            -destination "${{ matrix.destination }}" \
+            -derivedDataPath "$RUNNER_TEMP/dd-${{ matrix.platform }}"
+
+  thread-sanitizer:
+    name: Thread sanitizer
+    runs-on: macos-latest
+
+    steps:
+      - name: Check out repository
+        uses: actions/checkout@v7.0.0
+
+      # The Swift facades are declared @unchecked Sendable on the strength of
+      # the Objective-C core's internal locking. The concurrency tests exercise
+      # the shared instances from many tasks at once; under TSan they check that
+      # claim instead of merely asserting it.
+      - name: Run SwiftPM tests under the thread sanitizer
+        run: swift test --sanitize=thread
+
+  code-coverage:
+    name: Code coverage
+    runs-on: macos-latest
+
+    steps:
+      - name: Check out repository
+        uses: actions/checkout@v7.0.0
+
+      - name: Run SwiftPM tests with coverage
+        run: swift test --enable-code-coverage
+
+      - name: Export coverage report
+        run: |
+          set -euo pipefail
+          mkdir -p .build/coverage
+          xcrun llvm-cov export \
+            -format=lcov \
+            -instr-profile "$(swift test --show-codecov-path | xargs dirname)/default.profdata" \
+            "$(swift build --show-bin-path)/libPhoneNumberPackageTests.xctest/Contents/MacOS/libPhoneNumberPackageTests" \
+            > .build/coverage/coverage.lcov
+          xcrun llvm-cov report \
+            -instr-profile "$(swift test --show-codecov-path | xargs dirname)/default.profdata" \
+            "$(swift build --show-bin-path)/libPhoneNumberPackageTests.xctest/Con
```

**File**: `docs/TESTING.md` (modified, +66/-0)
```diff
@@ -36,6 +36,58 @@ Check package and README version alignment:
 swift scripts/checkVersionConsistency.swift
 ```
 
+## Concurrency Validation
+
+The Swift facades are declared `@unchecked Sendable` on the strength of the
+Objective-C core's internal locking, so the guarantee has to be exercised rather
+than trusted. Run the suite under the thread sanitizer whenever you touch
+mutable state in the Objective-C targets or add a facade entry point:
+
+```bash
+swift test --sanitize=thread
+```
+
+The concurrency suites live in `libPhoneNumberSwiftCoreTests` and in each
+optional module's test target. They drive the shared instances from many tasks
+at once; under the sanitizer an unguarded write is reported even when the
+assertions still pass. CI runs this on every pull request.
+
+## Platform Validation
+
+`swift test` only covers macOS. `Package.swift` declares six platforms, so build
+the package for each of the others before merging a packaging, linking, or
+availability change:
+
+```bash
+for destination in \
+  'generic/platform=iOS' \
+  'generic/platform=tvOS' \
+  'generic/platform=watchOS' \
+  'generic/platform=visionOS' \
+  'platform=macOS,variant=Mac Catalyst'
+do
+  xcodebuild build \
+    -workspace .swiftpm/xcode/package.xcworkspace \
+    -scheme libPhoneNumber-Package \
+    -destination "$destination" \
+    -derivedDataPath "/tmp/libphone-dd"
+done
+```
+
+CI runs the same matrix on every pull request.
+
+## Coverage
+
+```bash
+swift test --enable-code-coverage
+xcrun llvm-cov report \
+  -instr-profile "$(dirname "$(swift test --show-codecov-path)")/default.profdata" \
+  "$(swift build --show-bin-path)/libPhoneNumberPackageTests.xctest/Contents/MacOS/libPhoneNumberPackageTests"
+```
+
+Coverage is a review aid, not a merge gate. Use it to find untested branches in
+a module you changed, not to chase a number.
+
 ## Upstream Parity Validation
 
 Run the upstream test parity check:
@@ -133,6 +185,7 @@ For Swift facade changes:
 
 - `swift test`
 - `LC_ALL=ko_KR.UTF-8 LANG=ko_KR.UTF-8 swift test`
+- `swift test --sanitize=thread` when the change touches shared state or adds a facade entry point
 - `swift build -c release`
 - `swift scripts/publishPodspecs.swift --lint`
 - Confirm the facade remains a thin wrapper over the Objective-C core instead of duplicating phone-number logic.
@@ -142,6 +195,7 @@ For packaging changes:
 
 - `swift scripts/checkVersionConsistency.swift`
 - `swift scripts/publishPodspecs.swift --lint`
+- the per-platform build matrix above, since `swift test` only covers macOS
 
 ## Locale-Sensitive Tests
 
@@ -155,6 +209,18 @@ LC_ALL=ko_KR.UTF-8 LANG=ko_KR.UTF-8 swift test
 
 This catches tests that only pass on machines configured for English.
 
+## Test Frameworks
+
+New tests use [Swift Testing](https://developer.apple.com/documentation/testing)
+(`import Testing`, `@Suite`, `@Test`, `#expect`). Both frameworks run under
+`swift test` and each reports its own totals, so a green run shows two summary
+lines.
+
+The XCTest suites stay as they are. The Objective-C ones in particular mirror
+upstream test names one for one, which is what makes
+`scripts/checkUpstreamTestParity.swift` meaningful; converting them would break
+that mapping for no benefit.
+
 ## Adding Upstream-Ported Tests
 
 When porting an upstream JS test:
```

**File**: `scripts/publishPodspecs.swift` (modified, +6/-1)
```diff
@@ -148,7 +148,12 @@ func parsePodspec(at path: String) throws -> Podspec {
   guard result.exitCode == 0 else {
     throw ScriptError.commandFailed("pod ipc spec failed for \(path):\n\(result.output)")
   }
-  guard let data = result.output.data(using: .utf8),
+  // `pod ipc spec` writes its JSON to stdout, but CocoaPods also warns on
+  // stderr when the terminal is not set to UTF-8, and runCapturing merges the
+  // two. Start from the first brace so an unrelated warning does not look like
+  // a malformed podspec.
+  let jsonText = result.output.firstIndex(of: "{").map { String(result.output[$0...]) } ?? result.output
+  guard let data = jsonText.data(using: .utf8),
         let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
         let name = json["name"] as? String,
         let version = json["version"] as? String else {
```

**File**: `scripts/testXcodeSchemes.swift` (modified, +43/-6)
```diff
@@ -9,7 +9,9 @@ let defaultSchemes = [
 ]
 
 struct Options {
-  var destination = "platform=iOS Simulator,name=iPhone 16"
+  // Resolved from the installed simulators when --destination is not given, so
+  // the script does not fail on a machine that simply has a different iPhone.
+  var destination: String?
   var derivedDataRoot: URL?
   var schemes: [String] = []
 }
@@ -38,7 +40,7 @@ func usage() -> String {
     swift scripts/testXcodeSchemes.swift [options] [scheme ...]
 
   Options:
-    --destination <value>        xcodebuild destination. Default: platform=iOS Simulator,name=iPhone 16.
+    --destination <value>        xcodebuild destination. Default: the first available iPhone simulator.
     --derived-data-root <dir>    Use a separate derived data directory per scheme.
     --help                      Print this help.
 
@@ -57,6 +59,40 @@ func absoluteURL(forPath path: String) -> URL {
   return repositoryRoot.appendingPathComponent(path)
 }
 
+/// Returns `id=<udid>` for the first available iPhone simulator.
+///
+/// Naming a device model in the destination is brittle: every Xcode release
+/// ships a different set, so a pinned name fails with "Unable to find a device
+/// matching the provided destination specifier" on any machine that happens not
+/// to have it. Asking simctl what is installed avoids that.
+func firstAvailableIPhoneDestination() throws -> String {
+  let process = Process()
+  process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
+  process.arguments = ["xcrun", "simctl", "list", "devices", "available"]
+  let pipe = Pipe()
+  process.standardOutput = pipe
+  process.standardError = FileHandle.nullDevice
+
+  try process.run()
+  let data = pipe.fileHandleForReading.readDataToEndOfFile()
+  process.waitUntilExit()
+
+  let output = String(data: data, encoding: .utf8) ?? ""
+  for line in output.split(separator: "\n") where line.contains("iPhone") {
+    // Lines look like: "    iPhone Air (UDID) (Shutdown)"
+    let components = line.split(separator: "(", omittingEmptySubsequences: false)
+    guard components.count >= 2 else { continue }
+    let candidate = components[1].prefix(while: { $0 != ")" })
+    if candidate.count == 36 {
+      return "id=\(candidate)"
+    }
+  }
+
+  throw ScriptError.invalidArguments(
+    "No available iPhone simulator found. Install one, or pass --destination explicitly."
+  )
+}
+
 func parseOptions(_ arguments: [String]) throws -> Options {
   var options = Options()
   var index = 0
@@ -135,13 +171,13 @@ func run(_ command: String, _ arguments: [String]) throws {
   }
 }
 
-func testScheme(_ scheme: String, options: Options) throws {
+func testScheme(_ scheme: String, destination: String, options: Options) throws {
   var arguments = [
     "test",
     "-scheme",
     scheme,
     "-destination",
-    options.destination,
+    destination,
   ]
 
   if let derivedDataRoot = options.derivedDataRoot {
@@ -156,15 +192,16 @@ func testScheme(_ scheme: String, options: Options) throws {
 
 do {
   let options = try parseOptions(Array(CommandLine.arguments.dropFirst()))
+  let destination = try options.destination ?? firstAvailableIPhoneDestination()
 
-  print("Destination: \(options.destination)")
+  print("Destination: \(destination)")
   print("Schemes: \(options.schemes.joined(separator: ", "))")
   if let derivedDataRoot = options.derivedDataRoot {
     print("Derived data root: \(derivedDataRoot.path)")
   }
 
   for scheme in options.schemes {
-    try testScheme(scheme, options: options)
+    try testScheme(scheme, destination: destination, options: options)
   }
 
   print("\nAll Xcode schemes passed.")
```

---

### Incident Patch 10: `bfc53558` (2026-09-12)
**Commit Message**: feat(swift): build in the Swift 6 language mode and support visionOS

Every Swift facade entry point was a non-Sendable singleton, so
`PhoneNumberUtility.shared` and its four siblings were errors in the
Swift 6 language mode, not warnings. Six such statics existed, which made
the Swift-first facades unusable from the Swift code they exist to serve.

Declare the facades Sendable. The conformances are @unchecked and each
one documents the Objective-C locking it rests on, which the preceding
commit completed. PhoneNumber and AsYouTypeFormatter stay non-Sendable
and say why: the former is a mutable model object, the latter carries the
digits entered so far.

Raise the package to swift-tools-version 6.0, which the Swift 6 language
mode and the visionOS platform declaration both require. visionOS is now
declared in Package.swift, linked against Contacts, and given a
deployment target in every podspec. The podspecs accept Swift 5.9 or 6.0
so CocoaPods consumers are not forced onto one toolchain.

Two breaking changes come with it, so this needs a major release:

- PhoneNumberFieldState.error is a PhoneNumberValueError? rather than an
  existential Error?. The state becomes Sendable and it

**File**: `Package.swift` (modified, +6/-3)
```diff
@@ -1,5 +1,7 @@
-// swift-tools-version:5.5
+// swift-tools-version:6.0
 // The swift-tools-version declares the minimum version of Swift required to build this package.
+// Swift 6 tools are required so the Swift facade targets can build in the
+// Swift 6 language mode and so visionOS can be declared as a platform.
 import PackageDescription
 
 let package = Package(
@@ -9,7 +11,8 @@ let package = Package(
         .macCatalyst(.v15),
         .iOS(.v15),
         .tvOS(.v15),
-        .watchOS("9.0")
+        .watchOS("9.0"),
+        .visionOS(.v1)
     ],
     products: [
         .library(
@@ -92,7 +95,7 @@ let package = Package(
                 .headerSearchPath("Internal")
             ],
             linkerSettings: [
-                .linkedFramework("Contacts", .when(platforms: [.iOS, .macOS, .macCatalyst, .watchOS])),
+                .linkedFramework("Contacts", .when(platforms: [.iOS, .macOS, .macCatalyst, .watchOS, .visionOS])),
             ]
         ),
         .testTarget(
```

**File**: `README.md` (modified, +21/-0)
```diff
@@ -26,11 +26,15 @@ Use the Objective-C API when you need source-compatible legacy integration. Use
 | tvOS | 15.0 |
 | watchOS | 9.0 |
 | macOS | 12.0 |
+| visionOS | 1.0 |
 
 These are the lowest deployment targets Xcode 27 accepts. Version 1.7.x
 supports iOS 12, tvOS 12, watchOS 4, and macOS 10.13, but cannot be built
 with Xcode 27.
 
+The Swift package requires Swift 6 tools and builds in the Swift 6 language
+mode. The CocoaPods specs accept Swift 5.9 or 6.0.
+
 ## Recommended Setup
 
 For most Swift apps, start with the core Swift facade:
@@ -204,6 +208,23 @@ value.nationalSignificantNumber
 value.type
 ```
 
+### Concurrency
+
+`PhoneNumberUtility`, `PhoneNumberGeocoder`, `ShortNumberUtility`,
+`PhoneNumberCarrierMapper`, and `PhoneNumberTimeZonesMapper` are `Sendable`.
+Their shared instances can be used from any task without a Swift 6 concurrency
+error. The conformances are `@unchecked`, resting on the locking inside the
+Objective-C core, and the package's concurrency tests exercise the shared
+instances under load with the thread sanitizer enabled.
+
+Two types are deliberately not `Sendable`:
+
+- `PhoneNumber` (the Objective-C model object) is a mutable reference type. Keep
+  it inside the scope that parsed it and use `PhoneNumberValue` for anything
+  that is stored, encoded, or crosses an actor boundary.
+- `AsYouTypeFormatter` accumulates the digits entered so far. Create one per
+  input field.
+
 ### As-You-Type Formatting
 
 ```swift
```

**File**: `libPhoneNumber-iOS-Swift.podspec` (modified, +2/-1)
```diff
@@ -21,8 +21,9 @@ Pod::Spec.new do |s|
   s.osx.deployment_target = "12.0"
   s.watchos.deployment_target = "9.0"
   s.tvos.deployment_target = "15.0"
+  s.visionos.deployment_target = "1.0"
 
-  s.swift_version = "5.5"
+  s.swift_versions = ["5.9", "6.0"]
   s.requires_arc = true
 
   s.dependency 'libPhoneNumber-iOS-SwiftCore', '~> 2.0.1'
```

**File**: `libPhoneNumber-iOS-SwiftCarrier.podspec` (modified, +2/-1)
```diff
@@ -21,8 +21,9 @@ Pod::Spec.new do |s|
   s.osx.deployment_target = "12.0"
   s.watchos.deployment_target = "9.0"
   s.tvos.deployment_target = "15.0"
+  s.visionos.deployment_target = "1.0"
 
-  s.swift_version = "5.5"
+  s.swift_versions = ["5.9", "6.0"]
   s.requires_arc = true
 
   s.dependency 'libPhoneNumber-iOS-SwiftCore', '~> 2.0.1'
```

**File**: `libPhoneNumber-iOS-SwiftCore.podspec` (modified, +2/-1)
```diff
@@ -21,8 +21,9 @@ Pod::Spec.new do |s|
   s.osx.deployment_target = "12.0"
   s.watchos.deployment_target = "9.0"
   s.tvos.deployment_target = "15.0"
+  s.visionos.deployment_target = "1.0"
 
-  s.swift_version = "5.5"
+  s.swift_versions = ["5.9", "6.0"]
   s.requires_arc = true
 
   s.dependency 'libPhoneNumber-iOS', '~> 2.0.1'
```

**File**: `libPhoneNumber-iOS-SwiftGeocoding.podspec` (modified, +2/-1)
```diff
@@ -21,8 +21,9 @@ Pod::Spec.new do |s|
   s.osx.deployment_target = "12.0"
   s.watchos.deployment_target = "9.0"
   s.tvos.deployment_target = "15.0"
+  s.visionos.deployment_target = "1.0"
 
-  s.swift_version = "5.5"
+  s.swift_versions = ["5.9", "6.0"]
   s.requires_arc = true
 
   s.dependency 'libPhoneNumber-iOS-SwiftCore', '~> 2.0.1'
```

**File**: `libPhoneNumber-iOS-SwiftShortNumber.podspec` (modified, +2/-1)
```diff
@@ -21,8 +21,9 @@ Pod::Spec.new do |s|
   s.osx.deployment_target = "12.0"
   s.watchos.deployment_target = "9.0"
   s.tvos.deployment_target = "15.0"
+  s.visionos.deployment_target = "1.0"
 
-  s.swift_version = "5.5"
+  s.swift_versions = ["5.9", "6.0"]
   s.requires_arc = true
 
   s.dependency 'libPhoneNumber-iOS-SwiftCore', '~> 2.0.1'
```

**File**: `libPhoneNumber-iOS-SwiftTimeZones.podspec` (modified, +2/-1)
```diff
@@ -21,8 +21,9 @@ Pod::Spec.new do |s|
   s.osx.deployment_target = "12.0"
   s.watchos.deployment_target = "9.0"
   s.tvos.deployment_target = "15.0"
+  s.visionos.deployment_target = "1.0"
 
-  s.swift_version = "5.5"
+  s.swift_versions = ["5.9", "6.0"]
   s.requires_arc = true
 
   s.dependency 'libPhoneNumber-iOS-SwiftCore', '~> 2.0.1'
```

---

### Incident Patch 11: `ae92405c` (2026-09-12)
**Commit Message**: fix(geocoding): resolve metadata under SwiftPM and stop poisoning a language

Two failures that both surface as a correct-looking country name instead
of a locality, with no error and no crash.

The metadata bundle was never found under Swift Package Manager.
NBGeocoderMetaDataHelper appended GeocodingMetaData.bundle to
-[NSBundle bundleForClass:].resourceURL, which is where CocoaPods,
Carthage, and manual integration put the databases. SwiftPM nests them
inside a generated wrapper bundle, and emits that wrapper flat up to
Xcode 26 and macOS-structured from Xcode 27. No database was opened, so
every lookup fell through to countryNameForNumber:. Apply the same search
the carrier and timezone mappers already use, covering both layouts.

191c758 fixed this class of bug for carrier and timezone metadata and
recorded that geocoding resolves its bundle differently and was
unaffected. It resolves it differently, but it was affected: only the
Objective-C tests covered geocoding, and they inject a test bundle, so
the shipped path was never exercised.

Separately, a lookup for a country a language's database does not carry
disabled that language permanently. Only en.db has worldwide coverage

**File**: `README.md` (modified, +4/-0)
```diff
@@ -245,6 +245,10 @@ let number = try phoneUtil.parse("16502530000", defaultRegion: "US")
 let description = geocoder.description(for: number, languageCode: "en")
 ```
 
+Only the English database carries worldwide coverage. The other languages ship
+their own country, so a lookup outside it falls back to the localized country
+name rather than a locality.
+
 ### Carrier
 
 ```swift
```

**File**: `libPhoneNumberGeocoding/NBGeocoderMetaDataHelper.h` (modified, +17/-1)
```diff
@@ -29,10 +29,26 @@ NS_ASSUME_NONNULL_BEGIN
  */
 - (instancetype)initWithCountryCode:(NSNumber *)countryCode
                        withLanguage:(NSString *)languageCode
-                         withBundle:(NSBundle *)bundle;
+                         withBundle:(nullable NSBundle *)bundle;
 
+/**
+ * Initializer that resolves the shipped geocoding databases automatically.
+ *
+ * The payload is located by searching the loaded bundles, which covers
+ * CocoaPods, Carthage, manual integration, and the nested wrapper bundle
+ * SwiftPM generates. A helper created when no payload can be found answers
+ * every query with nil, and the geocoder falls back to country names.
+ */
 - (instancetype)initWithCountryCode:(NSNumber *)countryCode withLanguage:(NSString *)languageCode;
 
+/**
+ * The bundle holding the geocoding databases, or nil when none was found.
+ *
+ * Exposed so integrators can check whether the metadata resolved at all,
+ * instead of silently receiving country-level descriptions.
+ */
++ (nullable NSBundle *)defaultMetadataBundle;
+
 /**
  * Returns a text description for the given phone number. The description will be based on the
  * country code and national number attributes of the NBPhoneNumber parameter. If no result was
```

**File**: `libPhoneNumberGeocoding/NBGeocoderMetaDataHelper.m` (modified, +98/-11)
```diff
@@ -48,6 +48,10 @@ - (instancetype)initWithCountryCode:(NSNumber *)countryCode
     _countryCode = countryCode;
     _language = languageCode;
 
+    if (bundle == nil) {
+      return self;
+    }
+
     NSString *shortLanguageCode = [[languageCode componentsSeparatedByString:@"-"] firstObject];
     NSURL *databaseURL = [[bundle resourceURL]
         URLByAppendingPathComponent:[NSString stringWithFormat:@"%@.db", shortLanguageCode]];
@@ -69,25 +73,108 @@ - (instancetype)initWithCountryCode:(NSNumber *)countryCode
 }
 
 - (instancetype)initWithCountryCode:(NSNumber *)countryCode withLanguage:(NSString *)languageCode {
-  NSBundle *bundle = [NSBundle bundleForClass:self.classForCoder];
-  NSURL *resourceURL =
-      [[bundle resourceURL] URLByAppendingPathComponent:@"GeocodingMetaData.bundle"];
-  NSBundle *databaseBundle = [NSBundle bundleWithURL:resourceURL];
-  return [self initWithCountryCode:countryCode withLanguage:languageCode withBundle:databaseBundle];
+  return [self initWithCountryCode:countryCode
+                      withLanguage:languageCode
+                        withBundle:[NBGeocoderMetaDataHelper defaultMetadataBundle]];
+}
+
+// Locates GeocodingMetaData.bundle wherever the integration put it.
+//
+// Appending the payload to -[NSBundle bundleForClass:].resourceURL only works
+// for CocoaPods and manual integration, where the databases land next to the
+// consuming binary. SwiftPM nests them one level deeper, inside a generated
+// wrapper bundle, and emits that wrapper flat up to Xcode 26 but
+// macOS-structured (Contents/Resources) from Xcode 27. Without this search the
+// databases are simply not found and every lookup falls back to the country
+// name, with no error and no crash.
++ (NSBundle * _Nullable)defaultMetadataBundle {
+  static NSBundle *cachedBundle = nil;
+  static dispatch_once_t onceToken;
+  dispatch_once(&onceToken, ^{
+    NSMutableArray<NSBundle *> *searchBundles = [NSMutableArray arrayWithArray:NSBundle.allBundles];
+    [searchBundles addObjectsFromArray:NSBundle.allFrameworks];
+    [searchBundles addObject:[NSBundle bundleForClass:self]];
+    [searchBundles addObject:[NSBundle mainBundle]];
+
+    for (NSBundle *bundle in searchBundles) {
+      NSMutableArray<NSURL *> *baseURLs = [NSMutableArray array];
+      if (bundle.resourceURL != nil) {
+        [baseURLs addObject:bundle.resourceURL];
+      }
+      if (bundle.bundleURL != nil) {
+        [baseURLs addObject:bundle.bundleURL];
+      }
+
+      NSURL *parentURL = bundle.bundleURL;
+      for (NSUInteger index = 0; index < 5 && parentURL != nil; index++) {
+        parentURL = [parentURL URLByDeletingLastPathComponent];
+        if (parentURL != nil) {
+          [baseURLs addObject:parentURL];
+        }
+      }
+
+      for (NSURL *baseURL in baseURLs) {
+        NSURL *resourcesURL = [baseURL URLByAppendingPathComponent:@"Contents/Resources"];
+        NSURL *wrapperURL = [baseURL
+            URLByAppendingPathComponent:@"libPhoneNumber_libPhoneNumberGeocodingMetaData.bundle"];
+        NSURL *wrapperResourcesURL =
+            [wrapperURL URLByAppendingPathComponent:@"Contents/Resources"];
+        NSArray<NSURL *> *candidateURLs = @[
+          [baseURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+          [resourcesURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+          [wrapperURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+          [wrapperResourcesURL URLByAppendingPathComponent:@"GeocodingMetaData.bundle"],
+        ];
+
+        for (NSURL *candidateURL in candidateURLs) {
+          // en.db ships in every build of the payload, so it identifies a
+          // populated bundle rather than an empty directory of the right name.
+          NSURL *databaseURL = [candidateURL URLByAppendingPathComponent:@"en.db"];
+          if ([[NSFileManager defaultManager] fileExistsAtPath:databaseURL.path]) {
+            cachedBundle = [NSBundle bundleWithURL:candidateURL];
+            return;
+          }
+        }
+      }
+    }
+  });
+
+  return cachedBundle;
 }
 
 - (NSString * _Nullable)searchPhoneNumber:(NBPhoneNumber *)phoneNumber {
   @synchronized(self) {
-    if (_database == NULL || _selectStatement == NULL) {
+    if (_database == NULL) {
       return nil;
     }
 
-    if (![phoneNumber.countryCode isEqualToNumber:_countryCode]) {
+    // Each database holds one table per country calling code, and only the
+    // English database covers every country. Preparing a statement for a
+    // country this database does not carry fails, which is an ordinary "no
+    // data for this number" answer -- not a broken helper. Leaving the failed
+    // statement in place used to disable the helper permanently, so a single
+    // lookup for an uncovered country downgraded every later lookup in that
+    // language to a country name.
+    if (_selectStatement == NULL || ![phoneNumber.countryCode isEqualToNumber:_countryCode]) {
       _country
```

**File**: `libPhoneNumberIOSSwiftTests/PhoneNumberIOSSwiftTests.swift` (modified, +1/-1)
```diff
@@ -29,6 +29,6 @@ final class PhoneNumberIOSSwiftTests: XCTestCase {
         let geocoder = PhoneNumberGeocoder.shared
         let number = try util.parse("16502530000", defaultRegion: "US")
 
-        XCTAssertEqual("United States", geocoder.description(for: number, languageCode: "en"))
+        XCTAssertEqual("Mountain View, CA", geocoder.description(for: number, languageCode: "en"))
     }
 }
```

**File**: `libPhoneNumberSwiftGeocodingTests/PhoneNumberGeocodingFacadeTests.swift` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+import Testing
+import libPhoneNumberSwiftCore
+import libPhoneNumberSwiftGeocoding
+
+@Suite("Geocoder facade")
+struct PhoneNumberGeocodingFacadeTests {
+    private let util = PhoneNumberUtility.shared
+    private let geocoder = PhoneNumberGeocoder.shared
+
+    @Test("A geographical number resolves to a locality, not just the country")
+    func localityForGeographicalNumber() throws {
+        let number = try util.parse("6502530000", defaultRegion: "US")
+        let description = geocoder.description(forValidNumber: number, languageCode: "en")
+
+        #expect(description == "Mountain View, CA")
+    }
+
+    /// Only `en.db` carries worldwide coverage; the other databases hold their
+    /// own country. A language without an entry falls back to the country name,
+    /// which is correct behaviour, not a missing lookup.
+    @Test("Descriptions are localized by language code", arguments: [
+        ("en", "Seoul"),
+        ("ko", "서울"),
+    ])
+    func localizedDescriptions(languageCode: String, expected: String) throws {
+        let number = try util.parse("+8221234567", defaultRegion: nil)
+
+        #expect(geocoder.description(forValidNumber: number, languageCode: languageCode) == expected)
+    }
+
+    @Test("A language without locality data falls back to the country name")
+    func localizedFallback() throws {
+        let number = try util.parse("6502530000", defaultRegion: "US")
+
+        #expect(geocoder.description(forValidNumber: number, languageCode: "ko") == "미국")
+    }
+
+    @Test("A caller in the same region sees the locality; a caller abroad sees the country")
+    func userRegionChangesGranularity() throws {
+        let number = try util.parse("6502530000", defaultRegion: "US")
+
+        #expect(geocoder.description(for: number, languageCode: "en", userRegion: "US") == "Mountain View, CA")
+        #expect(geocoder.description(for: number, languageCode: "en", userRegion: "KR") == "United States")
+    }
+
+    /// Regression test: a lookup for a country the language's database does not
+    /// carry used to finalize the prepared statement and leave the helper
+    /// unusable, so every later lookup in that language returned a country name.
+    @Test("An uncovered country does not disable later lookups in the same language")
+    func uncoveredCountryDoesNotPoisonTheLanguage() throws {
+        let geocoder = PhoneNumberGeocoder()
+        let unitedStates = try util.parse("6502530000", defaultRegion: "US")
+        let korea = try util.parse("+8221234567", defaultRegion: nil)
+
+        // The Korean database carries only Korea, so this falls back.
+        #expect(geocoder.description(forValidNumber: unitedStates, languageCode: "ko") == "미국")
+        // The same helper must still answer for a country it does carry.
+        #expect(geocoder.description(forValidNumber: korea, languageCode: "ko") == "서울")
+        // And it must keep working when the country alternates.
+        #expect(geocoder.description(forValidNumber: unitedStates, languageCode: "ko") == "미국")
+        #expect(geocoder.description(forValidNumber: korea, languageCode: "ko") == "서울")
+    }
+
+    @Test("An unparseable number yields no description")
+    func unknownNumber() {
+        let number = PhoneNumber()
+        number.countryCode = 999
+        number.nationalNumber = 1
+
+        #expect(geocoder.description(for: number, languageCode: "en") == nil)
+    }
+
+    @Test("Concurrent lookups share one database connection safely")
+    func concurrentLookups() async throws {
+        let results = await withTaskGroup(of: String?.self) { group in
+            for _ in 0..<16 {
+                group.addTask {
+                    let util = PhoneNumberUtility.shared
+                    guard let number = try? util.parse("6502530000", defaultRegion: "US") else {
+                        return nil
+                    }
+                    return PhoneNumberGeocoder.shared.description(forValidNumber: number, languageCode: "en")
+                }
+            }
+
+            var collected: [String?] = []
+            for await result in group {
+                collected.append(result)
+            }
+            return collected
+        }
+
+        #expect(results.count == 16)
+        #expect(results.allSatisfy { $0 == "Mountain View, CA" })
+    }
+}
```

**File**: `libPhoneNumberSwiftGeocodingTests/PhoneNumberSwiftGeocodingTests.swift` (modified, +1/-1)
```diff
@@ -8,6 +8,6 @@ final class PhoneNumberSwiftGeocodingTests: XCTestCase {
         let geocoder = PhoneNumberGeocoder.shared
         let number = try util.parse("16502530000", defaultRegion: "US")
 
-        XCTAssertEqual("United States", geocoder.description(for: number, languageCode: "en"))
+        XCTAssertEqual("Mountain View, CA", geocoder.description(for: number, languageCode: "en"))
     }
 }
```

---

### Incident Patch 12: `9d5e9cac` (2026-09-12)
**Commit Message**: fix(core): guard shared mutable state in the Objective-C core

The shared NBPhoneNumberUtil is reachable from any thread, and three pieces
of state it owns or reaches were not protected:

- NBMetadataHelper built its region-to-calling-code table lazily with no
  synchronization, so concurrent first use raced on the ivar write.
- NBPhoneNumberOfflineGeocoder looked up its per-language helper in an
  NSCache and inserted on a miss, so concurrent callers could each open
  their own SQLite connection for the same language.
- NBRegularExpressionCache held @synchronized(self) across pattern
  compilation, serializing every caller behind an unrelated pattern being
  built, including callers that would have hit the cache.

Lock the metadata table with os_unfair_lock, move the geocoder's lookup
and insertion under one lock, and narrow the regex cache's lock to the
lookup and the insertion so compilation happens outside it. Two threads
racing on the same new pattern may now each compile it; the duplicate is
discarded on insertion.

This is a prerequisite for declaring the Swift facades Sendable: that
claim rests on this locking rather than on anything the compiler checks.

Co-Authored-By: Cl

**File**: `libPhoneNumber/NBMetadataHelper.m` (modified, +13/-1)
```diff
@@ -8,6 +8,8 @@
 
 #import "NBMetadataHelper.h"
 
+#import <os/lock.h>
+
 #import <NBGeneratedPhoneNumberMetaData.h>
 #import "NBPhoneMetaData.h"
 
@@ -34,7 +36,11 @@ @interface NBMetadataHelper ()
 @implementation NBMetadataHelper {
  @private
   NSDictionary *_phoneNumberDataDictionary;
+  // Lazily derived from _phoneNumberDataDictionary. Guarded by
+  // _countryCodeToCountryNumberLock because the helper is shared by the
+  // NBPhoneNumberUtil singleton and can be reached from multiple threads.
   NSDictionary *_countryCodeToCountryNumberDictionary;
+  os_unfair_lock _countryCodeToCountryNumberLock;
 }
 
 - (instancetype)init {
@@ -55,6 +61,7 @@ - (instancetype)initWithZippedDataBytes:(z_const Bytef *)data
   self = [super init];
 
   if (self != nil) {
+    _countryCodeToCountryNumberLock = OS_UNFAIR_LOCK_INIT;
     _metadataCache = [[NSCache alloc] init];
     _metadataMapCache = [[NSCache alloc] init];
     _phoneNumberDataDictionary =
@@ -74,6 +81,8 @@ - (instancetype)initWithZippedDataBytes:(z_const Bytef *)data
  */
 
 - (NSDictionary *)countryCodeToCountryNumberDictionary {
+  os_unfair_lock_lock(&_countryCodeToCountryNumberLock);
+
   if (_countryCodeToCountryNumberDictionary == nil) {
     NSDictionary *countryCodeToRegionCodeMap = [self countryCodeToRegionCodeDictionary];
     NSMutableDictionary *map = [[NSMutableDictionary alloc] init];
@@ -86,7 +95,10 @@ - (NSDictionary *)countryCodeToCountryNumberDictionary {
     _countryCodeToCountryNumberDictionary = [map copy];
   }
 
-  return _countryCodeToCountryNumberDictionary;
+  NSDictionary *result = _countryCodeToCountryNumberDictionary;
+  os_unfair_lock_unlock(&_countryCodeToCountryNumberLock);
+
+  return result;
 }
 
 - (NSDictionary *)countryCodeToRegionCodeDictionary {
```

**File**: `libPhoneNumber/NBRegularExpressionCache.m` (modified, +35/-17)
```diff
@@ -8,13 +8,17 @@
 
 #import "NBRegularExpressionCache.h"
 
+#import <os/lock.h>
+
 @interface NBRegularExpressionCache()
 
 @property (nonatomic, strong) NSCache *cache;
 
 @end
 
-@implementation NBRegularExpressionCache
+@implementation NBRegularExpressionCache {
+  os_unfair_lock _cacheLock;
+}
 
 + (instancetype)sharedInstance {
   static NBRegularExpressionCache *instance;
@@ -29,34 +33,48 @@ + (instancetype)sharedInstance {
 - (instancetype)init {
   self = [super init];
   if (self != nil) {
+    _cacheLock = OS_UNFAIR_LOCK_INIT;
     _cache = [[NSCache alloc] init];
   }
 
   return self;
 }
 
 - (NSRegularExpression *)regularExpressionForPattern:(NSString *)pattern error:(NSError **)error {
-  @synchronized(self) {
-    NSRegularExpression *cachedObject = [self.cache objectForKey:pattern];
-    if (cachedObject != nil) {
-      return cachedObject;
-    }
+  // Cache hits, which are the overwhelmingly common case, only hold the lock
+  // for the lookup itself. Compilation happens outside the lock so concurrent
+  // callers are not serialized behind an unrelated pattern being built. Two
+  // threads racing on the same new pattern may each compile it; the duplicate
+  // is simply discarded by the insertion below.
+  os_unfair_lock_lock(&_cacheLock);
+  NSRegularExpression *cachedObject = [self.cache objectForKey:pattern];
+  os_unfair_lock_unlock(&_cacheLock);
+
+  if (cachedObject != nil) {
+    return cachedObject;
+  }
 
-    NSError *regExError = nil;
-    NSRegularExpression *regEx = [[NSRegularExpression alloc] initWithPattern:pattern
-                                                                      options:kNilOptions
-                                                                        error:&regExError];
-    if (regEx == nil) {
-      if (error != NULL) {
-        *error = regExError;
-      }
-      return nil;
+  NSError *regExError = nil;
+  NSRegularExpression *regEx = [[NSRegularExpression alloc] initWithPattern:pattern
+                                                                    options:kNilOptions
+                                                                      error:&regExError];
+  if (regEx == nil) {
+    if (error != NULL) {
+      *error = regExError;
     }
+    return nil;
+  }
 
+  os_unfair_lock_lock(&_cacheLock);
+  NSRegularExpression *raced = [self.cache objectForKey:pattern];
+  if (raced != nil) {
+    regEx = raced;
+  } else {
     [self.cache setObject:regEx forKey:pattern];
-
-    return regEx;
   }
+  os_unfair_lock_unlock(&_cacheLock);
+
+  return regEx;
 }
 
 @end
```

**File**: `libPhoneNumberGeocoding/NBPhoneNumberOfflineGeocoder.m` (modified, +21/-5)
```diff
@@ -50,16 +50,32 @@ + (NBPhoneNumberOfflineGeocoder *)sharedInstance {
   return instance;
 }
 
+// Returns the cached helper for |languageCode|, creating it on first use.
+//
+// The lookup and the insertion are performed under a single lock so concurrent
+// callers cannot each open their own SQLite connection for the same language.
+- (NBGeocoderMetaDataHelper *)metadataHelperForLanguageCode:(NSString *)languageCode
+                                                countryCode:(NSNumber *)countryCode {
+  @synchronized(self) {
+    NBGeocoderMetaDataHelper *helper = [_metadataHelpers objectForKey:languageCode];
+    if (helper == nil) {
+      helper = _metadataHelperFactory(countryCode, languageCode);
+      if (helper != nil) {
+        [_metadataHelpers setObject:helper forKey:languageCode];
+      }
+    }
+    return helper;
+  }
+}
+
 - (nullable NSString *)descriptionForValidNumber:(NBPhoneNumber *)phoneNumber
                                 withLanguageCode:(NSString *)languageCode {
   // If the NSCache doesn't contain a key equivalent to languageCode, create a
   // new NBGeocoderMetadataHelper object with a language set equal to
   // languageCode and default country code to United States / Canada
-  if ([_metadataHelpers objectForKey:languageCode] == nil) {
-    [_metadataHelpers setObject:_metadataHelperFactory(phoneNumber.countryCode, languageCode)
-                         forKey:languageCode];
-  }
-  NSString *result = [[_metadataHelpers objectForKey:languageCode] searchPhoneNumber:phoneNumber];
+  NBGeocoderMetaDataHelper *helper =
+      [self metadataHelperForLanguageCode:languageCode countryCode:phoneNumber.countryCode];
+  NSString *result = [helper searchPhoneNumber:phoneNumber];
   if (result == nil) {
     return [self countryNameForNumber:phoneNumber withLanguageCode:languageCode];
   } else {
```

---

### Incident Patch 13: `191c758e` (2026-09-12)
**Commit Message**: fix(metadata): resolve metadata bundles under Xcode 27 layout

Xcode 27's SwiftPM emits resource bundles in the macOS-structured layout,
placing the payload under Contents/Resources instead of at the bundle
root:

  Xcode 26: libPhoneNumber_...MetaData.bundle/TimeZonesMetaData.bundle
  Xcode 27: libPhoneNumber_...MetaData.bundle/Contents/Resources/TimeZonesMetaData.bundle

The carrier and timezone mappers search for their payload by appending
path components directly, so neither found its database when the package
was built with Xcode 27. Both fall back silently: timeZonesForNumber:
returned Etc/Unknown and carrier lookups returned nil, with no error and
no crash.

Search Contents/Resources alongside the bundle root, for both the base
URL and the SwiftPM wrapper bundle, so the payload resolves under either
layout.

This is not a regression from 2.0.0 — the assumption predates it and only
surfaced once Xcode 27 changed the layout. Geocoding resolves its bundle
through -[NSBundle bundleForClass:] rather than this search and is
unaffected.

Verified on both toolchains with clean build directories. The 10 tests
that fail on Xcode 27 before this change (5 carrier, 5 timezone) pass
after

**File**: `libPhoneNumberCarrier/NBPhoneNumberToCarrierMapper.m` (modified, +9/-2)
```diff
@@ -164,10 +164,17 @@ + (NSBundle *)defaultMetadataBundle {
     }
 
     for (NSURL *baseURL in baseURLs) {
+      // SwiftPM emitted its resource bundle flat up to Xcode 26 and emits it
+      // macOS-structured (Contents/Resources) from Xcode 27, so look under both.
+      NSURL *resourcesURL = [baseURL URLByAppendingPathComponent:@"Contents/Resources"];
+      NSURL *wrapperURL = [baseURL URLByAppendingPathComponent:@"libPhoneNumber_libPhoneNumberCarrierMetaData.bundle"];
+      NSURL *wrapperResourcesURL =
+          [wrapperURL URLByAppendingPathComponent:@"Contents/Resources"];
       NSArray<NSURL *> *candidateURLs = @[
         [baseURL URLByAppendingPathComponent:@"CarrierMetaData.bundle"],
-        [[baseURL URLByAppendingPathComponent:@"libPhoneNumber_libPhoneNumberCarrierMetaData.bundle"]
-            URLByAppendingPathComponent:@"CarrierMetaData.bundle"],
+        [resourcesURL URLByAppendingPathComponent:@"CarrierMetaData.bundle"],
+        [wrapperURL URLByAppendingPathComponent:@"CarrierMetaData.bundle"],
+        [wrapperResourcesURL URLByAppendingPathComponent:@"CarrierMetaData.bundle"],
       ];
 
       for (NSURL *candidateURL in candidateURLs) {
```

**File**: `libPhoneNumberTimeZones/NBPhoneNumberToTimeZonesMapper.m` (modified, +9/-2)
```diff
@@ -143,10 +143,17 @@ + (NSBundle *)defaultMetadataBundle {
     }
 
     for (NSURL *baseURL in baseURLs) {
+      // SwiftPM emitted its resource bundle flat up to Xcode 26 and emits it
+      // macOS-structured (Contents/Resources) from Xcode 27, so look under both.
+      NSURL *resourcesURL = [baseURL URLByAppendingPathComponent:@"Contents/Resources"];
+      NSURL *wrapperURL = [baseURL URLByAppendingPathComponent:@"libPhoneNumber_libPhoneNumberTimeZonesMetaData.bundle"];
+      NSURL *wrapperResourcesURL =
+          [wrapperURL URLByAppendingPathComponent:@"Contents/Resources"];
       NSArray<NSURL *> *candidateURLs = @[
         [baseURL URLByAppendingPathComponent:@"TimeZonesMetaData.bundle"],
-        [[baseURL URLByAppendingPathComponent:@"libPhoneNumber_libPhoneNumberTimeZonesMetaData.bundle"]
-            URLByAppendingPathComponent:@"TimeZonesMetaData.bundle"],
+        [resourcesURL URLByAppendingPathComponent:@"TimeZonesMetaData.bundle"],
+        [wrapperURL URLByAppendingPathComponent:@"TimeZonesMetaData.bundle"],
+        [wrapperResourcesURL URLByAppendingPathComponent:@"TimeZonesMetaData.bundle"],
       ];
 
       for (NSURL *candidateURL in candidateURLs) {
```

---

### Incident Patch 14: `d05c9474` (2026-09-11)
**Commit Message**: fix(build): raise deployment targets for Xcode 27

Xcode 27 accepts iOS/tvOS 15-27, watchOS 9-27, and macOS 12-27. The
project declared iOS 12, tvOS 12, watchOS 4, and macOS 10.13, so builds
failed with "the range of supported deployment target versions is
15.0 to 27.0.x".

Raise every platform floor to the lowest version Xcode 27 accepts across
Package.swift, all 13 podspecs, libPhoneNumber.xcodeproj, and both demo
projects. macCatalyst moves to 15 to stay aligned with iOS.

watchOS uses the string form .watchOS("9.0") because .v9 requires
swift-tools-version 5.7 and the manifest targets 5.5.

Also drop the deprecated VALID_ARCHS setting, which still listed the
32-bit armv7/armv7s/i386 slices that no longer exist at these floors.

Fixes #449

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `Package.swift` (modified, +5/-5)
```diff
@@ -5,11 +5,11 @@ import PackageDescription
 let package = Package(
     name: "libPhoneNumber",
     platforms: [
-        .macOS(.v10_13),
-        .macCatalyst(.v13),
-        .iOS(.v12),
-        .tvOS(.v12),
-        .watchOS(.v4)
+        .macOS(.v12),
+        .macCatalyst(.v15),
+        .iOS(.v15),
+        .tvOS(.v15),
+        .watchOS("9.0")
     ],
     products: [
         .library(
```

**File**: `libPhoneNumber-Demo/libPhoneNumber-Demo-SPM.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -287,7 +287,7 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				IPHONEOS_DEPLOYMENT_TARGET = 13.5;
+				IPHONEOS_DEPLOYMENT_TARGET = 15.0;
 				MARKETING_VERSION = 1.7.8;
 				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
 				MTL_FAST_MATH = YES;
@@ -337,7 +337,7 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				IPHONEOS_DEPLOYMENT_TARGET = 13.5;
+				IPHONEOS_DEPLOYMENT_TARGET = 15.0;
 				MARKETING_VERSION = 1.7.8;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
```

**File**: `libPhoneNumber-Demo/libPhoneNumber-Demo.xcodeproj/project.pbxproj` (modified, +2/-2)
```diff
@@ -323,7 +323,7 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				IPHONEOS_DEPLOYMENT_TARGET = 13.5;
+				IPHONEOS_DEPLOYMENT_TARGET = 15.0;
 				MARKETING_VERSION = 1.7.8;
 				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
 				MTL_FAST_MATH = YES;
@@ -374,7 +374,7 @@
 				GCC_WARN_UNINITIALIZED_AUTOS = YES_AGGRESSIVE;
 				GCC_WARN_UNUSED_FUNCTION = YES;
 				GCC_WARN_UNUSED_VARIABLE = YES;
-				IPHONEOS_DEPLOYMENT_TARGET = 13.5;
+				IPHONEOS_DEPLOYMENT_TARGET = 15.0;
 				MARKETING_VERSION = 1.7.8;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				MTL_FAST_MATH = YES;
```

**File**: `libPhoneNumber-iOS-Swift.podspec` (modified, +4/-4)
```diff
@@ -17,10 +17,10 @@ Pod::Spec.new do |s|
                     :tag => s.version.to_s
                    }
 
-  s.ios.deployment_target = "12.0"
-  s.osx.deployment_target = "10.13"
-  s.watchos.deployment_target = "4.0"
-  s.tvos.deployment_target = "12.0"
+  s.ios.deployment_target = "15.0"
+  s.osx.deployment_target = "12.0"
+  s.watchos.deployment_target = "9.0"
+  s.tvos.deployment_target = "15.0"
 
   s.swift_version = "5.5"
   s.requires_arc = true
```

**File**: `libPhoneNumber-iOS-SwiftCarrier.podspec` (modified, +4/-4)
```diff
@@ -17,10 +17,10 @@ Pod::Spec.new do |s|
                     :tag => s.version.to_s
                    }
 
-  s.ios.deployment_target = "12.0"
-  s.osx.deployment_target = "10.13"
-  s.watchos.deployment_target = "4.0"
-  s.tvos.deployment_target = "12.0"
+  s.ios.deployment_target = "15.0"
+  s.osx.deployment_target = "12.0"
+  s.watchos.deployment_target = "9.0"
+  s.tvos.deployment_target = "15.0"
 
   s.swift_version = "5.5"
   s.requires_arc = true
```

**File**: `libPhoneNumber-iOS-SwiftCore.podspec` (modified, +4/-4)
```diff
@@ -17,10 +17,10 @@ Pod::Spec.new do |s|
                     :tag => s.version.to_s
                    }
 
-  s.ios.deployment_target = "12.0"
-  s.osx.deployment_target = "10.13"
-  s.watchos.deployment_target = "4.0"
-  s.tvos.deployment_target = "12.0"
+  s.ios.deployment_target = "15.0"
+  s.osx.deployment_target = "12.0"
+  s.watchos.deployment_target = "9.0"
+  s.tvos.deployment_target = "15.0"
 
   s.swift_version = "5.5"
   s.requires_arc = true
```

**File**: `libPhoneNumber-iOS-SwiftGeocoding.podspec` (modified, +4/-4)
```diff
@@ -17,10 +17,10 @@ Pod::Spec.new do |s|
                     :tag => s.version.to_s
                    }
 
-  s.ios.deployment_target = "12.0"
-  s.osx.deployment_target = "10.13"
-  s.watchos.deployment_target = "4.0"
-  s.tvos.deployment_target = "12.0"
+  s.ios.deployment_target = "15.0"
+  s.osx.deployment_target = "12.0"
+  s.watchos.deployment_target = "9.0"
+  s.tvos.deployment_target = "15.0"
 
   s.swift_version = "5.5"
   s.requires_arc = true
```

**File**: `libPhoneNumber-iOS-SwiftShortNumber.podspec` (modified, +4/-4)
```diff
@@ -17,10 +17,10 @@ Pod::Spec.new do |s|
                     :tag => s.version.to_s
                    }
 
-  s.ios.deployment_target = "12.0"
-  s.osx.deployment_target = "10.13"
-  s.watchos.deployment_target = "4.0"
-  s.tvos.deployment_target = "12.0"
+  s.ios.deployment_target = "15.0"
+  s.osx.deployment_target = "12.0"
+  s.watchos.deployment_target = "9.0"
+  s.tvos.deployment_target = "15.0"
 
   s.swift_version = "5.5"
   s.requires_arc = true
```

---

### Incident Patch 15: `258d7fa5` (2026-06-07)
**Commit Message**: fix(format): align short code E164 formatting

- Prefix raw zero-number inputs with the default country code for E164 formatting
- Preserve raw input formatting for non-default-country zero-number cases
- Add upstream parity coverage for Australian short code formatting

**File**: `libPhoneNumber/NBPhoneNumberUtil.m` (modified, +15/-7)
```diff
@@ -1145,14 +1145,22 @@ - (NSString * _Nullable)format:(NBPhoneNumber * _Nonnull)phoneNumber
 - (NSString * _Nonnull)format:(NBPhoneNumber * _Nonnull)phoneNumber numberFormat:(NBEPhoneNumberFormat)numberFormat {
   if ([phoneNumber.nationalNumber isEqualToNumber:@0] &&
       [NBMetadataHelper hasValue:phoneNumber.rawInput]) {
-    // Unparseable numbers that kept their raw input just use that.
-    // This is the only case where a number can be formatted as E164 without a
-    // leading '+' symbol (but the original number wasn't parseable anyway).
-    // TODO: Consider removing the 'if' above so that unparseable strings
-    // without raw input format to the empty string instead of "+00"
-    /** @type {string} */
+    // Unparseable numbers that kept their raw input just use that, unless the
+    // default country was specified and the format is E164. In that case, we
+    // prepend the raw input with the country code.
     NSString *rawInput = phoneNumber.rawInput;
-    if ([NBMetadataHelper hasValue:rawInput]) {
+    BOOL hasCountryCode = phoneNumber.countryCode != nil &&
+                          ![phoneNumber.countryCode isEqualToNumber:@-1];
+    if ([NBMetadataHelper hasValue:rawInput] &&
+        hasCountryCode &&
+        [phoneNumber.countryCodeSource integerValue] == NBECountryCodeSourceFROM_DEFAULT_COUNTRY &&
+        numberFormat == NBEPhoneNumberFormatE164) {
+      return [self prefixNumberWithCountryCallingCode:phoneNumber.countryCode
+                                    phoneNumberFormat:NBEPhoneNumberFormatE164
+                              formattedNationalNumber:rawInput
+                                   formattedExtension:@""];
+    } else if ([NBMetadataHelper hasValue:rawInput] ||
+               !hasCountryCode) {
       return rawInput;
     }
   }
```

**File**: `libPhoneNumberTests/NBPhoneNumberUtilTest.m` (modified, +23/-0)
```diff
@@ -848,6 +848,29 @@ - (void)testFormatAUNumber {
                                               numberFormat:NBEPhoneNumberFormatE164]);
 }
 
+- (void)testFormatAUShortCodeNumber {
+  NSError *anError = nil;
+  NBPhoneNumber *auShortCodeNumber = [_aUtil parse:@"000" defaultRegion:@"AU" error:&anError];
+  XCTAssertNil(anError);
+  XCTAssertEqualObjects(@"+61000", [_aUtil format:auShortCodeNumber
+                                      numberFormat:NBEPhoneNumberFormatE164]);
+
+  NBPhoneNumber *auRawShortCodeNumber = [[NBPhoneNumber alloc] init];
+  auRawShortCodeNumber.countryCode = @61;
+  auRawShortCodeNumber.nationalNumber = @0;
+  auRawShortCodeNumber.rawInput = @"000";
+  auRawShortCodeNumber.countryCodeSource = @(NBECountryCodeSourceFROM_DEFAULT_COUNTRY);
+  XCTAssertEqualObjects(@"+61000", [_aUtil format:auRawShortCodeNumber
+                                      numberFormat:NBEPhoneNumberFormatE164]);
+
+  NBPhoneNumber *pgShortCodeNumber = [[NBPhoneNumber alloc] init];
+  pgShortCodeNumber.countryCode = @675;
+  pgShortCodeNumber.nationalNumber = @0;
+  pgShortCodeNumber.rawInput = @"+675000";
+  XCTAssertEqualObjects(@"+675000", [_aUtil format:pgShortCodeNumber
+                                       numberFormat:NBEPhoneNumberFormatE164]);
+}
+
 - (void)testFormatARNumber {
   XCTAssertEqualObjects(@"011 8765-4321", [_aUtil format:self.arNumber
                                               numberFormat:NBEPhoneNumberFormatNATIONAL]);
```

#### Recent Merged Pull Requests:
- **PR #456** (2026-09-25): chore(release): refresh metadata for 2.1.1 (@iziz)
- **PR #455** (2026-09-17): chore(release): prepare 2.1.0 with Google metadata v9.0.39 (@iziz)
- **PR #454** (2026-09-12): Remove the breaking changes so the next release can be 2.1.0 (@iziz)
- **PR #453** (2026-09-12): Fix geocoding metadata resolution under SwiftPM and per-language statement poisoning (@iziz)
- **PR #452** (2026-09-12): Fix geocoding metadata resolution and adopt Swift 6 concurrency (@iziz)
- **PR #451** (2026-09-12): Resolve metadata bundles under Xcode 27's layout (2.0.1) (@iziz)
- **PR #450** (2026-09-11): Raise deployment targets for Xcode 27 (2.0.0) (@iziz)
- **PR #446** (closed): Attempting to do CI to run unit tests on all PRs. (@LowAmmo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
