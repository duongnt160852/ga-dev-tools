// Copyright 2020 Google Inc. All rights reserved.
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

import * as React from "react"

import { Params, Param, ValidationMessage, HitStatus, Property } from "./_types"
import * as hitUtils from "./_hit"
import { useSelector } from "react-redux"
import { getAnalyticsApi } from "../../api"

const formatMessage = (message: {
  parameter: any
  description: string
  messageType: any
  messageCode: any
}) => {
  const linkRegex = /Please see http:\/\/goo\.gl\/a8d4RP#\w+ for details\.$/
  return {
    param: message.parameter,
    description: message.description.replace(linkRegex, "").trim(),
    type: message.messageType,
    code: message.messageCode,
  }
}

type UseValidationServer = (
  parameters: Params
) => {
  validationMessages: ValidationMessage[]
  hitStatus: HitStatus
  // Validate the hit against the measurement protocol validation server
  validateHit: () => void
  // Send the hit to GA
  sendHit: () => void
}

// This hook encapsulates the logic needed for the validation server
export const useValidationServer: UseValidationServer = parameters => {
  const [hitStatus, setHitStatus] = React.useState(HitStatus.Unvalidated)
  const [validationMessages, setValidationMessages] = React.useState<
    ValidationMessage[]
  >([])

  const validateHit = React.useCallback(() => {
    setHitStatus(HitStatus.Validating)
    try {
      const hit = hitUtils.convertParamsToHit(parameters)
      hitUtils.getHitValidationResult(hit).then(validationResult => {
        const result = validationResult.response.hitParsingResult.find(
          a => a.valid === false
        )
        const validationMessages =
          result === undefined
            ? []
            : result.parserMessage.filter(
                // TODO - I might want to do something different with ERRORS
                // versus INFOs. Check what the current one does.
                message => message.messageType === "ERROR"
              )
        // TODO - make sure validationMessages defaults to an empty array when
        // nothing is wrong.
        setValidationMessages(validationMessages.map(formatMessage))
        if (result.valid) {
          setHitStatus(HitStatus.Valid)
          //       gaAll("send", "event", {
          //         eventCategory: "Hit Builder",
          //         eventAction: "validate",
          //         eventLabel: "valid",
          //       })
        } else {
          setHitStatus(HitStatus.Invalid)
          //       gaAll("send", "event", {
          //         eventCategory: "Hit Builder",
          //         eventAction: "validate",
          //         eventLabel: "invalid",
          //       })
        }
      })
    } catch (e) {
      // TODO - handle errors.
      //     gaAll("send", "event", {
      //       eventCategory: "Hit Builder",
      //       eventAction: "validate",
      //       eventLabel: "error",
      //     })
    }
  }, [parameters])

  const sendHit = React.useCallback(() => {
    //   /**
    //    * Sends the hit payload to Google Analytics and updates the button state
    //    * to indicate the hit was successfully sent. After 1 second the button
    //    * gets restored to its original state.
    //    */
    //   const sendHit = React.useCallback(async () => {
    //     await fetch("https://www.google-analytics.com/collect", {
    //       method: "POST",
    //       body: hitPayload,
    //     })
    //     setHitSent(true)
    //     // gaAll("send", "event", {
    //     //   eventCategory: "Hit Builder",
    //     //   eventAction: "send",
    //     //   eventLabel: "payload",
    //     // })
    //     // await sleep(ACTION_TIMEOUT)
    //     setHitSent(false)
    //   }, [hitPayload])
  }, [])

  return { validationMessages, validateHit, hitStatus, sendHit }
}

type UseParameters = () => {
  updateParameterName: (id: number, newName: string) => void
  updateParameterValue: (id: number, newValue: any) => void
  addParameter: () => void
  removeParameter: (id: number) => void
  parameters: Params
}
// This hook encapsulates the logic needed for adding, removing & updating parameters.
export const useParameters: UseParameters = () => {
  const [parameters, setParameters] = React.useState<Params>(() => {
    return hitUtils.convertHitToParams(hitUtils.getInitialHitAndUpdateUrl())
  })
  const [id, setId] = React.useState(0)

  const nextId = React.useCallback(() => {
    const next = id + 1
    setId(next)
    return next
  }, [id, setId])

  const addParameter = React.useCallback(() => {
    const id = nextId()
    const nuParameter: Param = { id, name: "", value: "" }
    setParameters(([v, t, tid, cid, ...others]) => {
      return [v, t, tid, cid, ...others.concat([nuParameter])]
    })
  }, [nextId])

  const removeParameter = React.useCallback((id: number) => {
    setParameters(([v, t, tid, cid, ...others]) => {
      return [v, t, tid, cid, ...others.filter(a => a.id !== id)]
    })
  }, [])

  const updateParameterName = React.useCallback(
    (id: number, newName: string) => {
      setParameters(([v, t, tid, cid, ...others]) => {
        return [
          v,
          t,
          tid,
          cid,
          ...others.map(param =>
            param.id === id ? { ...param, name: newName } : param
          ),
        ]
      })
    },
    []
  )

  const updateParameterValue = React.useCallback(
    (id: number, newValue: any) => {
      setParameters(params => {
        const nuParams = params.map(param =>
          param.id === id ? { ...param, value: newValue } : param
        ) as Params
        return nuParams
      })
    },
    []
  )

  return {
    updateParameterName,
    updateParameterValue,
    addParameter,
    removeParameter,
    parameters,
  }
}

type UseProperties = () => {
  properties: Property[]
}
// This hook encapsulates the logic for getting the user's GA properties using
// the management api.
export const useProperties: UseProperties = () => {
  const gapi = useSelector((state: AppState) => state.gapi)
  const [properties, setProperties] = React.useState<Property[]>([])

  React.useEffect(() => {
    if (gapi === undefined) {
      return
    }
    ;(async () => {
      const api = getAnalyticsApi(gapi)
      const summaries = (await api.management.accountSummaries.list({})).result
      const properties: Property[] = []
      summaries.items?.forEach(account => {
        const accountName = account.name || ""
        account.webProperties?.forEach(property => {
          const propertyName = property.name || ""
          const propertyId = property.id || ""
          properties.push({
            name: propertyName,
            id: propertyId,
            group: accountName,
          })
        })
      })
      setProperties(properties)
    })()
  }, [gapi])

  return { properties }
}