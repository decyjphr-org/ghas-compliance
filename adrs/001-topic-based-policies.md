# 0001. Strategy to support topic based policies for an organization.

Date: September 28, 2022

## Status

Pending

## Context

Enable the creation and use of multiple GitHub Security Policies that can be applied depending on the "TOPIC" meta-data field or potentially other repository meta-data fields. 
The applicability of a Policy will be dependent upon the Topics which will be applied using Boolean logic such as:
1.	One or more of a defined set of Topics is present
2.	One or more of a defined set of Topics is absent
3.	All Topics in a defined set are all present
4.	All topics in a defined set are absent


## Decision
### There would be a centralized `policy selector` file
For an organization, the policies will be stored in a centralized repo. There could be several policy files and the App will use a selector file to determine which policy files need to be loaded for a repo

```yaml
policies:
- name: critical policy
  path: policies/custom.yml
  selector: 
    topicsIncludesAny: ['rbfcalculatedrating-critical', 'externalfacingapplication-yes']
    topicsExcludesAny: ['mobileapplication-yes']
    topicsIncludesAll: ['rbfcalculatedrating-critical', 'externalfacingapplication-yes']
    topicsExcludesAll: ['mobileapplication-yes']
- name: not so critical policy
  path: policies/low.yml
  selector: 
    topicsIncludesAny: ['rbfcalculatedrating-critical', 'externalfacingapplication-yes']
    topicsExcludesAny: ['mobileapplication-yes']
    topicsIncludesAll: ['rbfcalculatedrating-critical', 'externalfacingapplication-yes']
    topicsExcludesAll: ['mobileapplication-yes']
```


## Consequences
How often do we load the policies? 
- For every webhook event
    - how will the app scale if there are thousands of events?
        - what happens when there are thousands of events?
            - the policy files will be loaded using the api and run into abuse limits
                - probot app can handle abuse limits by backing off automatically
            - the loading of policy files will run into rate limits if there are more than 15000 requests per hour
        - what happens when there are 1000s of policy files?
            - we only load the required policy file for a given repo for every webhook event
            - we will load the policy selector file for every webhook event
- Once when the app is started
    - how will be get the appropriate policies
        - all policies are stored in a singleton map
        - policy selector is stored as a singleton
    - how will be get updates or new files? 
        - restart the app 
- Once when the app is loaded and whenever the policy files change
  - How will the app know when the policy file has changed?
    - push event?
        - can the GHAS compliance listen to push events and ignore if it is not policy file changes?
          - How will ghas compliance app know what is a policy file?
            - based on the repo name
              - how will the app know what is a policy repo?
                - from the runtime settings

What if mutiple policies match
    - apply the first one
        - can we assume there will only be one policy for a given topic?
    - apply all of them sequentially
        - can we assume an order
    - deep merge all the matched policy objects
        - Could the previous option solve for most use cases?
            - It would for the current set of requirements
            

## Discarded solutions

<If other solutions were considered those should be mentioned here including why those were discarded.
It is important to show due diligence. If no other solutions were considered, add a reason why in this section.>