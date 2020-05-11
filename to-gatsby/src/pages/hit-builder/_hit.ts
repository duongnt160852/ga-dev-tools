// Copyright 2016 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* global $ */

import map from "lodash/map"
import querystring from "querystring"
import {
  Param,
  Params,
  RequiredParams,
  ParamV,
  ParamT,
  ParamTId,
  ParamCId,
  ParamOptional,
  HIT_TYPES,
} from "./_types"

const DEFAULT_HIT = "v=1&t=pageview"

let id = 1

/**
 * Gets the initial hit from the URL if present. If a hit is found in the URL
 * it is captured and immediately stripped as to have two sources of state.
 * If no hit is found in the URL the default hit is used.
 * @return The default hit.
 */
export function getInitialHitAndUpdateUrl(): string {
  const query = location.search.slice(1)

  if (query) {
    if (history && history.replaceState) {
      // TODO(mjhamrick) - figure out if this needs to be added back in.
      //history.replaceState(history.state, document.title, location.pathname);
    }
    return query
  } else {
    return DEFAULT_HIT
  }
}

/**
 * Accepts a hit payload or URL and converts it into an array of param objects
 * where the required params are always first and in the correct order.
 * @param hit A query string or hit payload.
 */
export function convertHitToParams(hit: string = ""): Params {
  // If the hit contains a "?", remove it and all characters before it.
  const searchIndex = hit.indexOf("?")
  if (searchIndex > -1) hit = hit.slice(searchIndex + 1)

  const query = querystring.parse(hit)

  // Create required params first, regardless of order in the hit.
  const v: ParamV = {
    id: id++,
    name: RequiredParams.V,
    value: query[RequiredParams.V] || "1",
    required: true,
  }
  const t: ParamT = {
    id: id++,
    name: RequiredParams.T,
    value: query[RequiredParams.T] || HIT_TYPES[0],
    required: true,
  }
  const tid: ParamTId = {
    id: id++,
    name: RequiredParams.T_Id,
    value: query[RequiredParams.T_Id] || "",
    required: true,
  }
  const cid: ParamCId = {
    id: id++,
    name: RequiredParams.C_Id,
    value: query[RequiredParams.C_Id] || "",
    required: true,
  }
  delete query[RequiredParams.V]
  delete query[RequiredParams.T]
  delete query[RequiredParams.T_Id]
  delete query[RequiredParams.C_Id]

  // Create optional params after required params.
  const others: ParamOptional[] = map(query, (value, name) => ({
    name,
    value,
    id: id++,
    isOptional: true,
  }))
  const params: Params = [v, t, tid, cid, ...others]
  return params
}

/**
 * Returns the hit model data as a query string.
 * @param params An array of param objects.
 */
export function convertParamsToHit(params: Param[]): string {
  const query: { [name: string]: any } = {}
  for (const { name, value } of params) {
    // `name` must be present, `value` can be an empty string.
    if (name && value != null) query[name] = value
  }

  return querystring.stringify(query)
}

interface ValidationResult {
  response: {
    parserMessage: any[]
    hitParsingResult: {
      valid: boolean
      parserMessage: {
        messageType: any
        description: string
        messageCode: any
        parameter: string
      }[]
      hit: string
    }[]
  }
  hit: string
}

/**
 * Sends a validation request to the Measurement Protocol Validation Server
 * and returns a promise that will be fulfilled with the response.
 * @param hit A Measurement Protocol hit payload.
 */
export async function getHitValidationResult(
  hit: string
): Promise<ValidationResult> {
  await new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, 1000)
  })
  const apiResponse = await fetch(
    "https://www.google-analytics.com/debug/collect",
    {
      method: "POST",
      body: hit,
    }
  )
  const asJson = await apiResponse.json()
  console.log({ asJson })
  return { response: asJson, hit }
}